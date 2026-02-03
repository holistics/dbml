import { CompileError } from '@/core/errors';
import { InterpreterDatabase, Ref, RefEndpoint, Table, TableRecordRow } from '@/core/interpreter/types';
import {
  extractKeyValueWithDefault,
  hasNullWithoutDefaultInKey,
  formatFullColumnNames,
  formatValues,
  createConstraintErrors,
} from './helper';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { mergeTableAndPartials, extractInlineRefsFromTablePartials } from '@/core/interpreter/utils';
import { isEmpty, flatMap } from 'lodash-es';

type TableInfo = {
  rows: TableRecordRow[];
  mergedTable: Table;
};

export function validateForeignKeys (env: InterpreterDatabase): CompileError[] {
  // Collect all refs: explicit refs + inline refs from table partials
  const refs = [
    ...env.ref.values(),
    ...flatMap(Array.from(env.tables.values()), (t) => extractInlineRefsFromTablePartials(t, env)),
  ];

  // Build table info map
  const tableInfoMap = buildTableInfoMap(env);

  return flatMap(refs, (ref) => validateRef(ref, tableInfoMap));
}

function buildTableInfoMap (env: InterpreterDatabase): Map<string, TableInfo> {
  const tableInfoMap = new Map<string, TableInfo>();

  for (const table of env.tables.values()) {
    const key = makeTableKey(table.schemaName, table.name);
    const rows = env.records.get(table) || [];

    if (!env.cachedMergedTables.has(table)) {
      env.cachedMergedTables.set(table, mergeTableAndPartials(table, env));
    }
    const mergedTable = env.cachedMergedTables.get(table)!;

    tableInfoMap.set(key, { mergedTable, rows });
  }

  return tableInfoMap;
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
): CompileError[] {
  if (isEmpty(sourceTable.rows)) return [];

  // Build set of valid target values for FK reference check
  const validFkValues = new Set(
    targetTable.rows.map((row) => extractKeyValueWithDefault(row.values, targetEndpoint.fieldNames)),
  );

  // Filter rows with NULL values (optional relationships)
  const rowsWithValues = sourceTable.rows.filter((row) =>
    !hasNullWithoutDefaultInKey(row.values, sourceEndpoint.fieldNames),
  );

  // Find rows with FK values that don't exist in target
  const invalidRows = rowsWithValues.filter((row) => {
    const fkValue = extractKeyValueWithDefault(row.values, sourceEndpoint.fieldNames);
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
    const valueStr = formatValues(row.values, sourceEndpoint.fieldNames);
    const message = `FK violation: ${sourceColumnRef} = ${valueStr} does not exist in ${targetColumnRef}`;

    return createConstraintErrors(row, sourceEndpoint.fieldNames, message);
  });
}

function validateRef (ref: Ref, tableInfoMap: Map<string, TableInfo>): CompileError[] {
  if (!ref.endpoints) return [];

  const [endpoint1, endpoint2] = ref.endpoints;
  const table1 = tableInfoMap.get(makeTableKey(endpoint1.schemaName, endpoint1.tableName));
  const table2 = tableInfoMap.get(makeTableKey(endpoint2.schemaName, endpoint2.tableName));

  if (!table1 || !table2) return [];

  return validateRelationship(table1, table2, endpoint1, endpoint2);
}

function validateRelationship (
  table1: TableInfo,
  table2: TableInfo,
  endpoint1: RefEndpoint,
  endpoint2: RefEndpoint,
): CompileError[] {
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
