import { flatMap, isEmpty } from 'lodash-es';
import type Compiler from '@/compiler/index';
import type { CompileWarning } from '@/core/types/errors';
import type { Filepath } from '@/core/types/filepath';
import type { SyntaxNode } from '@/core/types/nodes';
import type { Ref, RefEndpoint, TableRecord } from '@/core/types/schemaJson';
import type { TableSymbol } from '@/core/types/symbol';
import type { InternedNodeSymbol } from '@/core/types/symbol/symbols';
import {
  createConstraintWarning,
  extractKeyValueWithDefault,
  formatFullColumnNames,
  formatValues,
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

  return flatMap(relevantRefs, (ref) => validateRef(compiler, ref, tableInfoLookup, filepath));
}

// Validate that source's FK values exist in target's values
function validateFkSourceToTarget (
  compiler: Compiler,
  sourceTable: TableInfo,
  targetTable: TableInfo,
  sourceEndpoint: RefEndpoint,
  targetEndpoint: RefEndpoint,
  filepath: Filepath,
): CompileWarning[] {
  if (!sourceTable.record || isEmpty(sourceTable.record.values)) return [];

  const sourceRows = toKeyedRows(sourceTable.record);
  const targetRows = targetTable.record ? toKeyedRows(targetTable.record) : [];

  // Build set of valid target values for FK reference check
  const validFkValues = new Set(
    targetRows.map((row) => extractKeyValueWithDefault(row, targetEndpoint.fieldNames)),
  );

  // Filter rows with NULL values (optional relationships)
  const rowsWithValues = sourceRows
    .filter((row) => !hasNullWithoutDefaultInKey(row, sourceEndpoint.fieldNames));

  // Find rows with FK values that don't exist in target
  const invalidRows = rowsWithValues.filter((row) => {
    const fkValue = extractKeyValueWithDefault(row, sourceEndpoint.fieldNames);
    return !validFkValues.has(fkValue);
  });

  const sourceName = sourceTable.tableSymbol.interpretedName(compiler, filepath);
  const targetName = targetTable.tableSymbol.interpretedName(compiler, filepath);

  // Transform invalid rows to warnings
  return flatMap(invalidRows, (row) => {
    const sourceColumnRef = formatFullColumnNames(
      sourceName.schema,
      sourceName.name,
      sourceEndpoint.fieldNames,
    );
    const targetColumnRef = formatFullColumnNames(
      targetName.schema,
      targetName.name,
      targetEndpoint.fieldNames,
    );
    const valueStr = formatValues(row, sourceEndpoint.fieldNames);
    const message = `FK violation: ${sourceColumnRef} = ${valueStr} does not exist in ${targetColumnRef}`;

    return sourceEndpoint.fieldNames.map((col) =>
      createConstraintWarning(compiler, row[col], message),
    );
  });
}

function validateRef (compiler: Compiler, ref: Ref, tableInfoLookup: Map<string, TableInfo>, filepath: Filepath): CompileWarning[] {
  if (!ref.endpoints) return [];

  const [
    endpoint1,
    endpoint2,
  ] = ref.endpoints;
  const table1 = tableInfoLookup.get(makeTableKey(endpoint1.schemaName, endpoint1.tableName));
  const table2 = tableInfoLookup.get(makeTableKey(endpoint2.schemaName, endpoint2.tableName));

  if (!table1 || !table2) return [];

  return validateRelationship(compiler, table1, table2, endpoint1, endpoint2, filepath);
}

function validateRelationship (
  compiler: Compiler,
  table1: TableInfo,
  table2: TableInfo,
  endpoint1: RefEndpoint,
  endpoint2: RefEndpoint,
  filepath: Filepath,
): CompileWarning[] {
  const rel1 = endpoint1.relation;
  const rel2 = endpoint2.relation;

  // Bidirectional relationships: both 1-1 and many-to-many
  const isBidirectional = (rel1 === '1' && rel2 === '1') || (rel1 === '*' && rel2 === '*');
  if (isBidirectional) {
    return [
      ...validateFkSourceToTarget(compiler, table1, table2, endpoint1, endpoint2, filepath),
      ...validateFkSourceToTarget(compiler, table2, table1, endpoint2, endpoint1, filepath),
    ];
  }

  // Many-to-one: validate FK from "many" side to "one" side
  if (rel1 === '*' && rel2 === '1') {
    return validateFkSourceToTarget(compiler, table1, table2, endpoint1, endpoint2, filepath);
  }

  if (rel1 === '1' && rel2 === '*') {
    return validateFkSourceToTarget(compiler, table2, table1, endpoint2, endpoint1, filepath);
  }

  return [];
}
