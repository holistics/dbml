import { flatMap, isEmpty } from 'lodash-es';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
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
  toKeyedRows,
} from './helper';

// Per-table info for FK validation
export type TableInfo = {
  tableSymbol: TableSymbol;
  record: TableRecord | undefined;
  recordBlock: SyntaxNode | undefined;
};

export function validateForeignKeys (
  compiler: Compiler,
  allRefs: Ref[],
  allRecords: Map<InternedNodeSymbol, TableInfo>,
  filepath: Filepath,
): CompileWarning[] {
  return flatMap(allRefs, (ref) => validateRef(compiler, ref, allRecords, filepath));
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

function findTableInfo (
  tableInfoMap: Map<InternedNodeSymbol, TableInfo>,
  endpoint: RefEndpoint,
  compiler: Compiler,
  filepath: Filepath,
): TableInfo | undefined {
  const normalizedEndpointSchema = endpoint.schemaName === DEFAULT_SCHEMA_NAME ? null : endpoint.schemaName;
  for (const info of tableInfoMap.values()) {
    const {
      name, schema,
    } = info.tableSymbol.interpretedName(compiler, filepath);
    if (name === endpoint.tableName && schema === normalizedEndpointSchema) return info;
  }
  return undefined;
}

function validateRef (compiler: Compiler, ref: Ref, tableInfoMap: Map<InternedNodeSymbol, TableInfo>, filepath: Filepath): CompileWarning[] {
  if (!ref.endpoints) return [];

  const [
    endpoint1,
    endpoint2,
  ] = ref.endpoints;
  const table1 = findTableInfo(tableInfoMap, endpoint1, compiler, filepath);
  const table2 = findTableInfo(tableInfoMap, endpoint2, compiler, filepath);

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

  // Many-to-many: validate both directions
  if (rel1 === '*' && rel2 === '*') {
    return [
      ...validateFkSourceToTarget(compiler, table1, table2, endpoint1, endpoint2, filepath),
      ...validateFkSourceToTarget(compiler, table2, table1, endpoint2, endpoint1, filepath),
    ];
  }

  // One-to-one: FK is on the left side (endpoint1), validate left to right only.
  // 1-1 is not symmetric - it's a 1-[0..1] relationship from the right side's perspective.
  if (rel1 === '1' && rel2 === '1') {
    return validateFkSourceToTarget(compiler, table1, table2, endpoint1, endpoint2, filepath);
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
