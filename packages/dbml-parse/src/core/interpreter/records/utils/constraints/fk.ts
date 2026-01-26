import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase, Ref, RefEndpoint, Table, TableRecordRow } from '@/core/interpreter/types';
import { extractKeyValueWithDefault, hasNullWithoutDefaultInKey, formatFullColumnNames } from './helper';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { mergeTableAndPartials, extractInlineRefsFromTablePartials } from '@/core/interpreter/utils';

interface TableLookup {
  table: Table;
  mergedTable: Table;
  rows: TableRecordRow[];
}

type LookupMap = Map<string, TableLookup>;

// Create a table key from schema and table name
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

// Validate FK direction: source table values must exist in target table
function validateDirection (
  source: TableLookup,
  target: TableLookup,
  sourceEndpoint: RefEndpoint,
  targetEndpoint: RefEndpoint,
): CompileError[] {
  const errors: CompileError[] = [];

  if (source.rows.length === 0) {
    return errors;
  }

  const sourceTableColumns = new Set(source.mergedTable.fields.map((f) => f.name));
  if (sourceEndpoint.fieldNames.some((col) => !sourceTableColumns.has(col))) {
    return errors;
  }

  const targetTableColumns = new Set(target.mergedTable.fields.map((f) => f.name));
  if (targetEndpoint.fieldNames.some((col) => !targetTableColumns.has(col))) {
    return errors;
  }

  const validKeys = collectValidKeys(target.rows, targetEndpoint.fieldNames);

  for (const row of source.rows) {
    if (hasNullWithoutDefaultInKey(row.values, sourceEndpoint.fieldNames)) continue;

    const key = extractKeyValueWithDefault(row.values, sourceEndpoint.fieldNames);
    if (!validKeys.has(key)) {
      // Create separate error for each column in the constraint
      const errorNodes = sourceEndpoint.fieldNames
        .map((col) => row.columnNodes[col])
        .filter(Boolean);
      const isComposite = sourceEndpoint.fieldNames.length > 1;
      const sourceColumnRef = formatFullColumnNames(source.mergedTable.schemaName, source.mergedTable.name, sourceEndpoint.fieldNames);
      const targetColumnRef = formatFullColumnNames(target.mergedTable.schemaName, target.mergedTable.name, targetEndpoint.fieldNames);

      let msg: string;
      if (isComposite) {
        const valueStr = sourceEndpoint.fieldNames.map((col) => JSON.stringify(row.values[col]?.value)).join(', ');
        msg = `FK violation: ${sourceColumnRef} = (${valueStr}) does not exist in ${targetColumnRef}`;
      } else {
        const value = JSON.stringify(row.values[sourceEndpoint.fieldNames[0]]?.value);
        msg = `FK violation: ${sourceColumnRef} = ${value} does not exist in ${targetColumnRef}`;
      }

      if (errorNodes.length > 0) {
        // Create one error per column node
        for (const node of errorNodes) {
          errors.push(new CompileError(
            CompileErrorCode.INVALID_RECORDS_FIELD,
            msg,
            node,
          ));
        }
      } else {
        // Fallback to row node if no column nodes available
        errors.push(new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          msg,
          row.node,
        ));
      }
    }
  }

  return errors;
}

// Validate 1-1 relationship (both directions)
// * 1-1:     Both sides reference each other. Every non-null value in table1
// *          must exist in table2, and vice versa.
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
// * *-1:     Many-to-one. The "*" side (endpoint1) has FK referencing the "1" side.
// *          Values in endpoint1 must exist in endpoint2.
// * 1-*:     One-to-many. The "*" side (endpoint2) has FK referencing the "1" side.
// *          Values in endpoint2 must exist in endpoint1.
function validateManyToOne (
  manyTable: TableLookup,
  oneTable: TableLookup,
  manyEndpoint: RefEndpoint,
  oneEndpoint: RefEndpoint,
): CompileError[] {
  return validateDirection(manyTable, oneTable, manyEndpoint, oneEndpoint);
}

// Validate many-to-many relationship (both directions)
// * *-*:     Many-to-many. Both sides reference each other.
// *          Values in each table must exist in the other.
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

function validateRef (ref: Ref, lookup: LookupMap): CompileError[] {
  if (!ref.endpoints) {
    return [];
  }
  const [endpoint1, endpoint2] = ref.endpoints;

  const table1 = lookup.get(makeTableKey(endpoint1.schemaName, endpoint1.tableName));
  const table2 = lookup.get(makeTableKey(endpoint2.schemaName, endpoint2.tableName));

  if (!table1 || !table2) return [];

  const rel1 = endpoint1.relation;
  const rel2 = endpoint2.relation;

  if (rel1 === '1' && rel2 === '1') {
    return validateOneToOne(table1, table2, endpoint1, endpoint2);
  }

  if (rel1 === '*' && rel2 === '1') {
    return validateManyToOne(table1, table2, endpoint1, endpoint2);
  }

  if (rel1 === '1' && rel2 === '*') {
    return validateManyToOne(table2, table1, endpoint2, endpoint1);
  }

  if (rel1 === '*' && rel2 === '*') {
    return validateManyToMany(table1, table2, endpoint1, endpoint2);
  }

  return [];
}

export function validateForeignKeys (
  env: InterpreterDatabase,
): CompileError[] {
  const lookup = createRecordMapFromKey(env.tables, env.records, env);
  const refs = Array.from(env.ref.values());
  const errors: CompileError[] = [];

  for (const ref of refs) {
    errors.push(...validateRef(ref, lookup));
  }

  // Also validate inline refs from table partials
  for (const mergedTableData of lookup.values()) {
    const { table } = mergedTableData;
    const partialRefs = extractInlineRefsFromTablePartials(table, env);

    for (const ref of partialRefs) {
      errors.push(...validateRef(ref, lookup));
    }
  }

  return errors;
}
