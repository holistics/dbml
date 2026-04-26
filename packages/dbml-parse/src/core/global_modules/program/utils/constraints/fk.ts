import {
  flatMap, isEmpty,
} from 'lodash-es';
import type Compiler from '@/compiler/index';
import type {
  CompileWarning,
} from '@/core/types/errors';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  Ref, RefEndpoint, TableRecord,
} from '@/core/types/schemaJson';
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
  record: TableRecord | undefined;
  schemaName: string | null;
  tableName: string;
  recordBlock: SyntaxNode;
};

export function validateForeignKeys (
  compiler: Compiler,
  allRefs: Ref[],
  allRecords: Map<string, TableInfo>,
): CompileWarning[] {
  return flatMap(allRefs, (ref) => validateRef(compiler, ref, allRecords));
}

// Validate that source's FK values exist in target's values
function validateFkSourceToTarget (
  compiler: Compiler,
  sourceTable: TableInfo,
  targetTable: TableInfo,
  sourceEndpoint: RefEndpoint,
  targetEndpoint: RefEndpoint,
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

  // Transform invalid rows to warnings
  return flatMap(invalidRows, (row) => {
    const sourceColumnRef = formatFullColumnNames(
      sourceTable.schemaName,
      sourceTable.tableName,
      sourceEndpoint.fieldNames,
    );
    const targetColumnRef = formatFullColumnNames(
      targetTable.schemaName,
      targetTable.tableName,
      targetEndpoint.fieldNames,
    );
    const valueStr = formatValues(row, sourceEndpoint.fieldNames);
    const message = `FK violation: ${sourceColumnRef} = ${valueStr} does not exist in ${targetColumnRef}`;

    return sourceEndpoint.fieldNames.map((col) =>
      createConstraintWarning(compiler, row[col], message),
    );
  });
}

function validateRef (compiler: Compiler, ref: Ref, tableInfoMap: Map<string, TableInfo>): CompileWarning[] {
  if (!ref.endpoints) return [];

  const [
    endpoint1,
    endpoint2,
  ] = ref.endpoints;
  const table1 = tableInfoMap.get(makeTableKey(endpoint1.schemaName, endpoint1.tableName));
  const table2 = tableInfoMap.get(makeTableKey(endpoint2.schemaName, endpoint2.tableName));

  if (!table1 || !table2) return [];

  return validateRelationship(compiler, table1, table2, endpoint1, endpoint2);
}

function validateRelationship (
  compiler: Compiler,
  table1: TableInfo,
  table2: TableInfo,
  endpoint1: RefEndpoint,
  endpoint2: RefEndpoint,
): CompileWarning[] {
  const rel1 = endpoint1.relation;
  const rel2 = endpoint2.relation;

  // Bidirectional relationships: both 1-1 and many-to-many
  const isBidirectional = (rel1 === '1' && rel2 === '1') || (rel1 === '*' && rel2 === '*');
  if (isBidirectional) {
    return [
      ...validateFkSourceToTarget(compiler, table1, table2, endpoint1, endpoint2),
      ...validateFkSourceToTarget(compiler, table2, table1, endpoint2, endpoint1),
    ];
  }

  // Many-to-one: validate FK from "many" side to "one" side
  if (rel1 === '*' && rel2 === '1') {
    return validateFkSourceToTarget(compiler, table1, table2, endpoint1, endpoint2);
  }

  if (rel1 === '1' && rel2 === '*') {
    return validateFkSourceToTarget(compiler, table2, table1, endpoint2, endpoint1);
  }

  return [];
}
