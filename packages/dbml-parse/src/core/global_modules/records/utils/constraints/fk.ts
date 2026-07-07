import { compact, flatMap, isEmpty } from 'lodash-es';
import type Compiler from '@/compiler/index';
import type { CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import type { SyntaxNode } from '@/core/types/nodes';
import { parseCardinality } from '@/core/types/relation';
import type { RelationCardinality } from '@/core/types/relation';
import type { Ref, TableRecord } from '@/core/types/schemaJson';
import type { TableSymbol } from '@/core/types/symbol';
import type { ColumnSymbol, InternedNodeSymbol } from '@/core/types/symbol/symbols';
import {
  createConstraintWarning,
  extractKeyValueWithDefault,
  formatFullColumnNames,
  formatValues,
  getDiagnosticAnchorValues,
  hasNullWithoutDefaultInKey,
  makeTableKey,
  toKeyedRows,
} from './helper';

// Per-table info for FK validation
export type TableInfo = {
  tableSymbol: TableSymbol;
  record: TableRecord | undefined;
  recordBlock: SyntaxNode | undefined;
};

// Prebuild a map from a table's qualified name to the table info
// This allows for O(1) accesses later
function buildTableInfoLookup (
  allRecords: Map<InternedNodeSymbol, TableInfo>,
  compiler: Compiler,
  filepath: Filepath,
): Map<string, TableInfo> {
  const lookup = new Map<string, TableInfo>();
  for (const info of allRecords.values()) {
    const { name, schema } = info.tableSymbol.interpretedName(compiler, filepath);
    lookup.set(makeTableKey(schema, name), info);
  }
  return lookup;
}

export function validateForeignKeys (
  compiler: Compiler,
  allRefs: Ref[],
  allRecords: Map<InternedNodeSymbol, TableInfo>,
  filepath: Filepath,
): CompileWarning[] {
  const tableInfoLookup = buildTableInfoLookup(allRecords, compiler, filepath);

  // Pre-filter: only validate refs where at least one endpoint has records
  // There's no use validating refs where both endpoints have no records
  const tablesWithRecords = new Set<string>();
  for (const [
    key,
    info,
  ] of tableInfoLookup) {
    if (info.record && !isEmpty(info.record.values)) {
      tablesWithRecords.add(key);
    }
  }

  const relevantRefs = allRefs.filter((ref) => {
    if (!ref.endpoints) return false;
    return ref.endpoints.some((ep) => tablesWithRecords.has(makeTableKey(ep.schemaName, ep.tableName)));
  });

  return flatMap(relevantRefs, (ref) => validateForeignKey(compiler, ref, tableInfoLookup, filepath));
}

// Validate 1 foreign key constraint only
function validateForeignKey (
  compiler: Compiler,
  ref: Ref, // The constraint to validate
  tableInfoLookup: Map<string, TableInfo>, // Fast info lookup
  filepath: Filepath,
): CompileWarning[] {
  if (!ref.endpoints) return [];

  const [
    rawEndpoint1,
    rawEndpoint2,
  ] = ref.endpoints;
  const table1 = tableInfoLookup.get(makeTableKey(rawEndpoint1.schemaName, rawEndpoint1.tableName));

  const table2 = tableInfoLookup.get(makeTableKey(rawEndpoint2.schemaName, rawEndpoint2.tableName));

  if (!table1 || !table2) return [];

  const endpoint1 = table1.tableSymbol.mergedColumns(compiler).filter((c) => typeof c.name === 'string' && rawEndpoint1.fieldNames.includes(c.name));
  const endpoint2 = table2.tableSymbol.mergedColumns(compiler).filter((c) => typeof c.name === 'string' && rawEndpoint2.fieldNames.includes(c.name));

  return [
    // card2 constrains table1's rows
    ...validateEndpoint(compiler, table1, endpoint1, table2, endpoint2, rawEndpoint2.relation, filepath),
    // card1 constrains table2's rows
    ...validateEndpoint(compiler, table2, endpoint2, table1, endpoint1, rawEndpoint1.relation, filepath),
  ];
}

// Validate left records against the right cardinality.
//   - right min = 0  -> left allows NULL
//   - right min >= 1 -> left must not be NULL
//   - right max = 1  -> left must map to exactly 1 right row (FK existence)
//   - right max = *  -> no FK constraint
function validateEndpoint (
  compiler: Compiler,
  leftTable: TableInfo,
  leftEndpoint: ColumnSymbol[],
  rightTable: TableInfo,
  rightEndpoint: ColumnSymbol[],
  rightCard: RelationCardinality, // This will constrains the left table's records
  filepath: Filepath,
): CompileWarning[] {
  if (!leftTable.record || isEmpty(leftTable.record.values)) return [];

  const { min: rightMin } = parseCardinality(rightCard);

  const leftColumnNames = compact(leftEndpoint.map((c) => c.name));
  const rightColumnNames = compact(rightEndpoint.map((c) => c.name));

  // right min = 0 -> left FK values may be NULL (optional relationship)
  // right min >= 1 -> left FK values must not be NULL
  const allowNull = rightMin === 0;

  const leftRows = toKeyedRows(leftTable.record);
  const rightRows = rightTable.record ? toKeyedRows(rightTable.record) : [];

  const validFkValues = new Set(
    rightRows.map((row) => extractKeyValueWithDefault(compiler, row, rightEndpoint)),
  );

  const leftName = leftTable.tableSymbol.interpretedName(compiler, filepath);
  const rightName = rightTable.tableSymbol.interpretedName(compiler, filepath);

  return flatMap(leftRows, (row) => {
    const isNull = hasNullWithoutDefaultInKey(compiler, row, leftEndpoint);

    if (isNull) {
      if (allowNull) return [];
      const leftColumnRef = formatFullColumnNames(leftName.schema, leftName.name, leftColumnNames);
      const valueStr = formatValues(compiler, row, leftEndpoint);
      const message = `FK violation: ${leftColumnRef} = ${valueStr} must not be null`;

      return getDiagnosticAnchorValues(row, leftColumnNames)
        .map((v) => createConstraintWarning(compiler, v, message));
    }

    // right max = 1 -> non-null left value must map to exactly 1 right row
    // right max = * -> non-null left value must exist in right
    // Both cases: left value must exist in right values
    const fkValue = extractKeyValueWithDefault(compiler, row, leftEndpoint);
    if (validFkValues.has(fkValue)) return [];

    const leftColumnRef = formatFullColumnNames(leftName.schema, leftName.name, leftColumnNames);
    const rightColumnRef = formatFullColumnNames(rightName.schema, rightName.name, rightColumnNames);
    const valueStr = formatValues(compiler, row, leftEndpoint);
    const message = `FK violation: ${leftColumnRef} = ${valueStr} does not exist in ${rightColumnRef}`;
    return getDiagnosticAnchorValues(row, leftColumnNames)
      .map((v) => createConstraintWarning(compiler, v, message));
  });
}
