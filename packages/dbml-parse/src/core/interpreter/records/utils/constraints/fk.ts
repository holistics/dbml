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

type TableInfo = {
  rows: TableRecordRow[];
  mergedTable: Table;
};

export function validateForeignKeys (env: InterpreterDatabase): CompileError[] {
  // Table partials' inline refs do not show up in env.ref
  const refs = [...env.ref.values()].concat([...env.tables.values()].flatMap((t) => extractInlineRefsFromTablePartials(t, env)));

  const tableInfoMap = new Map<string, TableInfo>();

  for (const table of env.tables.values()) {
    const key = makeTableKey(table.schemaName, table.name);
    const rows = env.records.get(table) || [];
    const mergedTable = mergeTableAndPartials(table, env);
    tableInfoMap.set(key, { mergedTable, rows });
  }

  return refs.flatMap((ref) => validateRef(ref, tableInfoMap));
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
  if (sourceTable.rows.length === 0) return [];

  // Build set of valid target values for FK reference check
  const validFkValues = new Set(targetTable.rows.flatMap((row) => extractKeyValueWithDefault(row.values, targetEndpoint.fieldNames)));

  return sourceTable.rows.flatMap((row) => {
    // NULL FK values are allowed (optional relationship)
    if (hasNullWithoutDefaultInKey(row.values, sourceEndpoint.fieldNames)) return [];

    const fkValue = extractKeyValueWithDefault(row.values, sourceEndpoint.fieldNames);
    if (validFkValues.has(fkValue)) return [];

    // Prepare for error message
    const sourceColumnRef = formatFullColumnNames(sourceTable.mergedTable.schemaName, sourceTable.mergedTable.name, sourceEndpoint.fieldNames);
    const targetColumnRef = formatFullColumnNames(targetTable.mergedTable.schemaName, targetTable.mergedTable.name, targetEndpoint.fieldNames);
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

  const rel1 = endpoint1.relation;
  const rel2 = endpoint2.relation;

  // 1-1: bidirectional reference - both sides must exist in the other
  if (rel1 === '1' && rel2 === '1') {
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

  // Many-to-many: bidirectional reference - both sides must exist in the other
  if (rel1 === '*' && rel2 === '*') {
    return [
      ...validateFkSourceToTarget(table1, table2, endpoint1, endpoint2),
      ...validateFkSourceToTarget(table2, table1, endpoint2, endpoint1),
    ];
  }

  return [];
}
