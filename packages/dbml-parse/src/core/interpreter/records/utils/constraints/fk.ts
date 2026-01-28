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

interface TableLookup {
  table: Table;
  mergedTable: Table;
  rows: TableRecordRow[];
}

type LookupMap = Map<string, TableLookup>;

function makeTableKey (schema: string | null | undefined, table: string): string {
  return schema ? `${schema}.${table}` : `${DEFAULT_SCHEMA_NAME}.${table}`;
}

function createRecordMapFromKey (
  tables: Map<unknown, Table>,
  records: Map<Table, TableRecordRow[]>,
  env: InterpreterDatabase,
): LookupMap {
  const lookup = new Map<string, TableLookup>();

  for (const table of tables.values()) {
    const key = makeTableKey(table.schemaName, table.name);
    const rows = records.get(table) || [];
    const mergedTable = mergeTableAndPartials(table, env);
    lookup.set(key, { table, mergedTable, rows });
  }

  return lookup;
}

function collectValidKeys (rows: TableRecordRow[], columnNames: string[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!hasNullWithoutDefaultInKey(row.values, columnNames)) {
      keys.add(extractKeyValueWithDefault(row.values, columnNames));
    }
  }
  return keys;
}

function hasAllColumns (endpoint: RefEndpoint, tableColumns: Set<string>): boolean {
  return endpoint.fieldNames.every((col) => tableColumns.has(col));
}

function validateDirection (
  source: TableLookup,
  target: TableLookup,
  sourceEndpoint: RefEndpoint,
  targetEndpoint: RefEndpoint,
): CompileError[] {
  if (source.rows.length === 0) return [];

  // Skip validation if referenced columns don't exist in schema
  const sourceTableColumns = new Set(source.mergedTable.fields.map((f) => f.name));
  if (!hasAllColumns(sourceEndpoint, sourceTableColumns)) return [];

  const targetTableColumns = new Set(target.mergedTable.fields.map((f) => f.name));
  if (!hasAllColumns(targetEndpoint, targetTableColumns)) return [];

  // Build set of valid target values for FK reference check
  const validKeys = collectValidKeys(target.rows, targetEndpoint.fieldNames);
  const errors: CompileError[] = [];

  for (const row of source.rows) {
    // NULL FK values are allowed (optional relationship)
    if (hasNullWithoutDefaultInKey(row.values, sourceEndpoint.fieldNames)) continue;

    const key = extractKeyValueWithDefault(row.values, sourceEndpoint.fieldNames);
    if (validKeys.has(key)) continue;

    const sourceColumnRef = formatFullColumnNames(source.mergedTable.schemaName, source.mergedTable.name, sourceEndpoint.fieldNames);
    const targetColumnRef = formatFullColumnNames(target.mergedTable.schemaName, target.mergedTable.name, targetEndpoint.fieldNames);
    const valueStr = formatValues(row.values, sourceEndpoint.fieldNames);
    const message = `FK violation: ${sourceColumnRef} = ${valueStr} does not exist in ${targetColumnRef}`;

    errors.push(...createConstraintErrors(row, sourceEndpoint.fieldNames, message));
  }

  return errors;
}

function validateRef (ref: Ref, lookup: LookupMap): CompileError[] {
  if (!ref.endpoints) return [];

  const [endpoint1, endpoint2] = ref.endpoints;
  const table1 = lookup.get(makeTableKey(endpoint1.schemaName, endpoint1.tableName));
  const table2 = lookup.get(makeTableKey(endpoint2.schemaName, endpoint2.tableName));

  if (!table1 || !table2) return [];

  const rel1 = endpoint1.relation;
  const rel2 = endpoint2.relation;

  // 1-1: bidirectional reference - both sides must exist in the other
  if (rel1 === '1' && rel2 === '1') {
    return [
      ...validateDirection(table1, table2, endpoint1, endpoint2),
      ...validateDirection(table2, table1, endpoint2, endpoint1),
    ];
  }

  // Many-to-one: validate FK from "many" side to "one" side
  if (rel1 === '*' && rel2 === '1') {
    return validateDirection(table1, table2, endpoint1, endpoint2);
  }

  if (rel1 === '1' && rel2 === '*') {
    return validateDirection(table2, table1, endpoint2, endpoint1);
  }

  // Many-to-many: bidirectional reference - both sides must exist in the other
  if (rel1 === '*' && rel2 === '*') {
    return [
      ...validateDirection(table1, table2, endpoint1, endpoint2),
      ...validateDirection(table2, table1, endpoint2, endpoint1),
    ];
  }

  return [];
}

export function validateForeignKeys (env: InterpreterDatabase): CompileError[] {
  const lookup = createRecordMapFromKey(env.tables, env.records, env);
  const errors: CompileError[] = [];

  for (const ref of env.ref.values()) {
    errors.push(...validateRef(ref, lookup));
  }

  for (const { table } of lookup.values()) {
    const partialRefs = extractInlineRefsFromTablePartials(table, env);
    for (const ref of partialRefs) {
      errors.push(...validateRef(ref, lookup));
    }
  }

  return errors;
}
