import type { CompileWarning } from '@/core/types/errors';
import type { Ref, RefEndpoint, Table, TableRecord } from '@/core/types/schemaJson';
import {
  buildColumnIndex,
  extractKeyValueWithDefault,
  hasNullWithoutDefaultInKey,
  formatFullColumnNames,
  formatValues,
  createConstraintErrors,
} from './helper';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { isEmpty, flatMap } from 'lodash-es';

type TableInfo = {
  rows: TableRecord;
  mergedTable: Table;
};

export function validateForeignKeys (
  allRefs: Ref[],
  allRecords: Map<string, TableInfo>,
): CompileWarning[] {
  return flatMap(allRefs, (ref) => validateRef(ref, allRecords));
}

function makeTableKey (schema: string | null | undefined, table: string): string {
  return schema ? `${schema}.${table}` : `${DEFAULT_SCHEMA_NAME}.${table}`;
}

// Validate that source's values exist in target's values
function validateFkSourceToTarget (
  sourceTable: TableInfo,
  targetTable: TableInfo,
  sourceEndpoint: RefEndpoint,
  targetEndpoint: RefEndpoint,
): CompileWarning[] {
  if (isEmpty(sourceTable.rows.values)) return [];

  const sourceColumnIndex = buildColumnIndex(sourceTable.rows);
  const targetColumnIndex = buildColumnIndex(targetTable.rows);

  // Build set of valid target values for FK reference check
  const validFkValues = new Set(
    targetTable.rows.values.map((row) =>
      extractKeyValueWithDefault(row, targetEndpoint.fieldNames, targetColumnIndex),
    ),
  );

  // Filter rows with NULL values (optional relationships)
  const rowsWithValues = sourceTable.rows.values.filter((row) =>
    !hasNullWithoutDefaultInKey(row, sourceEndpoint.fieldNames, sourceColumnIndex),
  );

  // Find rows with FK values that don't exist in target
  const invalidRows = rowsWithValues.filter((row) => {
    const fkValue = extractKeyValueWithDefault(row, sourceEndpoint.fieldNames, sourceColumnIndex);
    return !validFkValues.has(fkValue);
  });

  // Transform invalid rows to errors
  return flatMap(invalidRows, (row) => {
    const sourceColumnRef = formatFullColumnNames(
      sourceTable.mergedTable.schemaName,
      sourceTable.mergedTable.name,
      sourceEndpoint.fieldNames,
    );
    const targetColumnRef = formatFullColumnNames(
      targetTable.mergedTable.schemaName,
      targetTable.mergedTable.name,
      targetEndpoint.fieldNames,
    );
    const valueStr = formatValues(row, sourceEndpoint.fieldNames, sourceColumnIndex);
    const message = `FK violation: ${sourceColumnRef} = ${valueStr} does not exist in ${targetColumnRef}`;

    // Create one error per FK column in the source endpoint
    return sourceEndpoint.fieldNames.flatMap(() => createConstraintErrors(sourceTable.rows, message));
  });
}

function validateRef (ref: Ref, tableInfoMap: Map<string, TableInfo>): CompileWarning[] {
  if (!ref.endpoints) return [];

  const [endpoint1, endpoint2] = ref.endpoints;
  const key1 = makeTableKey(endpoint1.schemaName, endpoint1.tableName);
  const key2 = makeTableKey(endpoint2.schemaName, endpoint2.tableName);
  const table1 = tableInfoMap.get(key1);
  const table2 = tableInfoMap.get(key2);

  if (!table1 || !table2) return [];

  return validateRelationship(table1, table2, endpoint1, endpoint2);
}

function validateRelationship (
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
      ...validateFkSourceToTarget(table1, table2, endpoint1, endpoint2),
      ...validateFkSourceToTarget(table2, table1, endpoint2, endpoint1),
    ];
  }

  // Many-to-one: validate FK from "many" side to "one" side
  if (rel1 === '*' && rel2 === '1') {
    return validateFkSourceToTarget(table1, table2, endpoint1, endpoint2);
  }

  if (rel1 === '1' && rel2 === '*') {
    return validateFkSourceToTarget(table2, table1, endpoint2, endpoint1);
  }

  return [];
}
