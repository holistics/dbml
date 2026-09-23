import { compact, flatMap, isEmpty } from 'lodash-es';
import type Compiler from '@/compiler/index';
import type { CompileInfo } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import type { SyntaxNode } from '@/core/types/nodes';
import { parseCardinality } from '@/core/types/relation';
import type { RelationCardinality } from '@/core/types/relation';
import type { Ref, TableRecord } from '@/core/types/schemaJson';
import type { TableSymbol } from '@/core/types/symbol';
import type { ColumnSymbol, InternedNodeSymbol } from '@/core/types/symbol/symbols';
import {
  recordsFkNull,
  recordsFkNotFound,
} from '@/core/utils/diagnostics_reporter';
import {
  resolveRecordValueNode,
  extractKeyValueWithDefault,
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
): CompileInfo[] {
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
): CompileInfo[] {
  if (!ref.endpoints) return [];

  const [
    rawEndpoint1,
    rawEndpoint2,
  ] = ref.endpoints;
  const table1 = tableInfoLookup.get(makeTableKey(rawEndpoint1.schemaName, rawEndpoint1.tableName));

  const table2 = tableInfoLookup.get(makeTableKey(rawEndpoint2.schemaName, rawEndpoint2.tableName));

  if (!table1 || !table2) return [];

  const columns1 = table1.tableSymbol.mergedColumns(compiler);
  const columns2 = table2.tableSymbol.mergedColumns(compiler);
  const endpoint1 = compact(rawEndpoint1.fieldNames.map((fn) => columns1.find((c) => c.name === fn)));
  const endpoint2 = compact(rawEndpoint2.fieldNames.map((fn) => columns2.find((c) => c.name === fn)));

  const { min: min1, max: max1 } = parseCardinality(rawEndpoint1.relation);
  const { min: min2, max: max2 } = parseCardinality(rawEndpoint2.relation);
  const isOneToOne = max1 !== '*' && max2 !== '*';

  // Skip the one side when the other side is optional, or always skip the left side of a 1-1
  const skipTable1 = (max1 === 1 && min2 === 0) || isOneToOne;
  const skipTable2 = max2 === 1 && min1 === 0;

  return [
    // card2 constrains table1's rows
    ...(skipTable1 ? [] : validateEndpoint(compiler, table1, endpoint1, table2, endpoint2, rawEndpoint1.relation, rawEndpoint2.relation, filepath)),
    // card1 constrains table2's rows
    ...(skipTable2 ? [] : validateEndpoint(compiler, table2, endpoint2, table1, endpoint1, rawEndpoint2.relation, rawEndpoint1.relation, filepath)),
  ];
}

// Validate left records against the right cardinality.
//   - right min = 0  -> left allows NULL
//   - right min >= 1 -> left must not be NULL
//   - right max = 1  -> left must map to exactly 1 right row (FK existence)
//   - right max = * and left min >= 1 -> left must exist in right
//   - right max = * and left min = 0 and left max = * -> no FK existence constraint
function validateEndpoint (
  compiler: Compiler,
  leftTable: TableInfo,
  leftEndpoint: ColumnSymbol[],
  rightTable: TableInfo,
  rightEndpoint: ColumnSymbol[],
  leftCard: RelationCardinality,
  rightCard: RelationCardinality, // This will constrains the left table's records
  filepath: Filepath,
): CompileInfo[] {
  if (!leftTable.record || isEmpty(leftTable.record.values)) return [];

  const { min: leftMin, max: leftMax } = parseCardinality(leftCard);
  const { min: rightMin, max: rightMax } = parseCardinality(rightCard);

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

  const fkOptions = {
    leftTable: leftTable.tableSymbol,
    leftColumns: leftEndpoint,
    rightTable: rightTable.tableSymbol,
    rightColumns: rightEndpoint,
    filepath,
  };

  return flatMap(leftRows, (row) => {
    const isNull = hasNullWithoutDefaultInKey(compiler, row, leftEndpoint);

    if (isNull) {
      if (allowNull) return [];
      const valueStr = formatValues(compiler, row, leftEndpoint);
      return getDiagnosticAnchorValues(row, leftColumnNames)
        .map((v) => recordsFkNull(compiler, resolveRecordValueNode(compiler, v), { ...fkOptions, valueStr }));
    }

    // right max = 1 -> non-null left value must map to exactly 1 right row
    // right max = * and left min = 0 and left max = * -> no FK existence constraint
    // right max = * and not above -> non-null left value must exist in right
    if (rightMax === '*' && leftMin === 0 && leftMax === '*') return [];

    const fkValue = extractKeyValueWithDefault(compiler, row, leftEndpoint);
    if (validFkValues.has(fkValue)) return [];

    const valueStr = formatValues(compiler, row, leftEndpoint);
    return getDiagnosticAnchorValues(row, leftColumnNames)
      .map((v) => recordsFkNotFound(compiler, resolveRecordValueNode(compiler, v), { ...fkOptions, valueStr }));
  });
}
