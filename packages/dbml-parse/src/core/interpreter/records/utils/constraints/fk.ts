import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase, Ref, RefEndpoint, Table, TableRecordRow } from '@/core/interpreter/types';
import { extractKeyValue, formatColumns, hasNullInKey } from './helper';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

/**
 * FK Relationship Types (endpoint1.relation - endpoint2.relation):
 *
 * 1-1:     Both sides reference each other. Every non-null value in table1
 *          must exist in table2, and vice versa.
 *
 * *-1:     Many-to-one. The "*" side (endpoint1) has FK referencing the "1" side.
 *          Values in endpoint1 must exist in endpoint2.
 *
 * 1-*:     One-to-many. The "*" side (endpoint2) has FK referencing the "1" side.
 *          Values in endpoint2 must exist in endpoint1.
 *
 * *-*:     Many-to-many. Both sides reference each other.
 *          Values in each table must exist in the other.
 *
 * Note: "0" optionality (nullable FK) is handled by skipping NULL values during validation.
 */

interface TableLookup {
  table: Table;
  rows: TableRecordRow[];
}

type LookupMap = Map<string, TableLookup>;

// Create a table key from schema and table name
function makeTableKey (schema: string | null | undefined, table: string): string {
  return schema ? `${schema}.${table}` : `${DEFAULT_SCHEMA_NAME}.${table}`;
}

// Build lookup map indexed by schema.table key
function createRecordMapFromKey (
  records: Map<Table, TableRecordRow[]>,
): LookupMap {
  const lookup = new Map<string, TableLookup>();
  for (const [table, rows] of records) {
    const key = makeTableKey(table.schemaName, table.name);
    lookup.set(key, { table, rows });
  }
  return lookup;
}

// Build set of valid keys from a table's records
function collectValidKeys (rows: TableRecordRow[], columnNames: string[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) {
    if (!hasNullInKey(row.values, columnNames)) {
      keys.add(extractKeyValue(row.values, columnNames));
    }
  }
  return keys;
}

// Validate FK direction: source table values must exist in target table
function validateDirection (
  source: TableLookup,
  target: TableLookup,
  sourceEndpoint: RefEndpoint,
  targetEndpoint: RefEndpoint,
): CompileError[] {
  const errors: CompileError[] = [];

  // Collect column names from source and target
  const sourceColumns = new Set<string>();
  for (const row of source.rows) {
    for (const colName of Object.keys(row.values)) {
      sourceColumns.add(colName);
    }
  }

  const targetColumns = new Set<string>();
  for (const row of target.rows) {
    for (const colName of Object.keys(row.values)) {
      targetColumns.add(colName);
    }
  }

  // Skip if columns not found in source or target
  if (sourceEndpoint.fieldNames.some((col) => !sourceColumns.has(col))
    || targetEndpoint.fieldNames.some((col) => !targetColumns.has(col))) {
    return errors;
  }

  const validKeys = collectValidKeys(target.rows, targetEndpoint.fieldNames);
  const columnsStr = formatColumns(sourceEndpoint.fieldNames);

  for (const row of source.rows) {
    // NULL FK values are allowed (0..1 / 0..* optionality)
    if (hasNullInKey(row.values, sourceEndpoint.fieldNames)) continue;

    const key = extractKeyValue(row.values, sourceEndpoint.fieldNames);
    if (!validKeys.has(key)) {
      errors.push(new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Foreign key violation: value for column ${columnsStr} does not exist in referenced table '${targetEndpoint.tableName}'`,
        row.node,
      ));
    }
  }

  return errors;
}

// Validate 1-1 relationship (both directions)
function validateOneToOne (
  table1: TableLookup,
  table2: TableLookup,
  endpoint1: RefEndpoint,
  endpoint2: RefEndpoint,
): CompileError[] {
  return [
    ...validateDirection(table1, table2, endpoint1, endpoint2),
    ...validateDirection(table2, table1, endpoint2, endpoint1),
  ];
}

// Validate many-to-one relationship (FK on many side)
function validateManyToOne (
  manyTable: TableLookup,
  oneTable: TableLookup,
  manyEndpoint: RefEndpoint,
  oneEndpoint: RefEndpoint,
): CompileError[] {
  return validateDirection(manyTable, oneTable, manyEndpoint, oneEndpoint);
}

// Validate many-to-many relationship (both directions)
function validateManyToMany (
  table1: TableLookup,
  table2: TableLookup,
  endpoint1: RefEndpoint,
  endpoint2: RefEndpoint,
): CompileError[] {
  return [
    ...validateDirection(table1, table2, endpoint1, endpoint2),
    ...validateDirection(table2, table1, endpoint2, endpoint1),
  ];
}

// Validate a single ref constraint
function validateRef (ref: Ref, lookup: LookupMap): CompileError[] {
  if (!ref.endpoints) {
    return [];
  }
  const [endpoint1, endpoint2] = ref.endpoints;

  const table1 = lookup.get(makeTableKey(endpoint1.schemaName, endpoint1.tableName));
  const table2 = lookup.get(makeTableKey(endpoint2.schemaName, endpoint2.tableName));

  // Skip if either table has no records
  if (!table1 || !table2) return [];

  const rel1 = endpoint1.relation;
  const rel2 = endpoint2.relation;

  // 1-1: Validate both directions
  if (rel1 === '1' && rel2 === '1') {
    return validateOneToOne(table1, table2, endpoint1, endpoint2);
  }

  // *-1: Many-to-one (endpoint1 is FK source)
  if (rel1 === '*' && rel2 === '1') {
    return validateManyToOne(table1, table2, endpoint1, endpoint2);
  }

  // 1-*: One-to-many (endpoint2 is FK source)
  if (rel1 === '1' && rel2 === '*') {
    return validateManyToOne(table2, table1, endpoint2, endpoint1);
  }

  // *-*: Many-to-many - validate both directions
  if (rel1 === '*' && rel2 === '*') {
    return validateManyToMany(table1, table2, endpoint1, endpoint2);
  }

  return [];
}

// Main entry point: validate all foreign key constraints
export function validateForeignKeys (
  env: InterpreterDatabase,
): CompileError[] {
  const lookup = createRecordMapFromKey(env.records);
  const refs = Array.from(env.ref.values());
  const errors: CompileError[] = [];

  for (const ref of refs) {
    errors.push(...validateRef(ref, lookup));
  }

  return errors;
}
