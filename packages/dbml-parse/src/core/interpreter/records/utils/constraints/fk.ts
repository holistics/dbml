import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase, Ref, RefEndpoint, Table, TableRecord } from '@/core/interpreter/types';
import { RecordsBatch } from '../../types';
import { extractKeyValue, formatColumns, getColumnIndices, hasNullInKey } from './helper';
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
  record: TableRecord;
  batch: RecordsBatch;
}

type LookupMap = Map<string, TableLookup>;

// Create a table key from schema and table name
function makeTableKey (schema: string | null | undefined, table: string): string {
  return schema ? `${schema}.${table}` : `${DEFAULT_SCHEMA_NAME}.${table}`;
}

// Build lookup map indexed by schema.table key
function createRecordMapFromKey (
  recordMap: Map<Table, { batch: RecordsBatch; record: TableRecord }>,
): LookupMap {
  const lookup = new Map<string, TableLookup>();
  for (const { batch, record } of recordMap.values()) {
    const key = makeTableKey(batch.schema, batch.table);
    lookup.set(key, { record, batch });
  }
  return lookup;
}

// Build set of valid keys from a table's records
function collectValidKeys (record: TableRecord, columnIndices: number[]): Set<string> {
  const keys = new Set<string>();
  for (const row of record.values) {
    if (!hasNullInKey(row, columnIndices)) {
      keys.add(extractKeyValue(row, columnIndices));
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

  const sourceIndices = getColumnIndices(source.record.columns, sourceEndpoint.fieldNames);
  const targetIndices = getColumnIndices(target.record.columns, targetEndpoint.fieldNames);

  // Skip if columns not found
  if (sourceIndices.some((i) => i === -1) || targetIndices.some((i) => i === -1)) {
    return errors;
  }

  const validKeys = collectValidKeys(target.record, targetIndices);
  const columnsStr = formatColumns(sourceEndpoint.fieldNames);

  for (let i = 0; i < source.record.values.length; i++) {
    const row = source.record.values[i];
    const rowNode = source.batch.rows[i];

    // NULL FK values are allowed (0..1 / 0..* optionality)
    if (hasNullInKey(row, sourceIndices)) continue;

    const key = extractKeyValue(row, sourceIndices);
    if (!validKeys.has(key)) {
      errors.push(new CompileError(
        CompileErrorCode.INVALID_RECORDS_FIELD,
        `Foreign key violation: value for column ${columnsStr} does not exist in referenced table '${targetEndpoint.tableName}'`,
        rowNode,
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
  recordMap: Map<Table, { batch: RecordsBatch; record: TableRecord }>,
  env: InterpreterDatabase,
): CompileError[] {
  const lookup = createRecordMapFromKey(recordMap);
  const refs = Array.from(env.ref.values());
  const errors: CompileError[] = [];

  for (const ref of refs) {
    errors.push(...validateRef(ref, lookup));
  }

  return errors;
}
