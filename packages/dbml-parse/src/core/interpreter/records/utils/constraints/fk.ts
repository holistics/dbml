import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase, Ref, RefEndpoint, Table, TableRecordRow } from '@/core/interpreter/types';
import { extractKeyValueWithDefault, hasNullWithoutDefaultInKey, formatFullColumnNames } from './helper';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { mergeTableAndPartials, extractInlineRefsFromTablePartials } from '@/core/interpreter/utils';

export function validateForeignKeys (
  env: InterpreterDatabase,
): CompileError[] {
  const refs = Array.from(env.ref.values());
  const errors: CompileError[] = [];

  // Validate explicit relationship definitions
  for (const ref of refs) {
    errors.push(...validateReference(ref, env));
  }

  // Validate inline refs from table partials
  for (const table of env.tables.values()) {
    const partialRefs = extractInlineRefsFromTablePartials(table, env);
    for (const ref of partialRefs) {
      errors.push(...validateReference(ref, env));
    }
  }

  return errors;
}

function findTable (
  schemaName: string | null | undefined,
  tableName: string,
  env: InterpreterDatabase,
): Table | undefined {
  for (const table of env.tables.values()) {
    if (table.name === tableName && table.schemaName === (schemaName || DEFAULT_SCHEMA_NAME)) {
      return table;
    }
  }
  return undefined;
}

/**
 * Get set of valid keys for given columns in a table.
 * Returns all non-NULL key combinations.
 */
function collectValidKeys (
  table: Table,
  columnNames: string[],
  env: InterpreterDatabase,
): Set<string> {
  const rows = env.records.get(table) || [];
  const keys = new Set<string>();

  for (const row of rows) {
    if (!hasNullWithoutDefaultInKey(row.values, columnNames)) {
      keys.add(extractKeyValueWithDefault(row.values, columnNames));
    }
  }

  return keys;
}

/**
 * Validate a single relationship definition.
 * Routes to appropriate validator based on cardinality.
 */
function validateReference (ref: Ref, env: InterpreterDatabase): CompileError[] {
  if (!ref.endpoints) return [];

  const [endpoint1, endpoint2] = ref.endpoints;
  const table1 = findTable(endpoint1.schemaName, endpoint1.tableName, env);
  const table2 = findTable(endpoint2.schemaName, endpoint2.tableName, env);

  if (!table1 || !table2) return [];

  const rel1 = endpoint1.relation;
  const rel2 = endpoint2.relation;

  // Route to appropriate validator based on relationship type
  if (rel1 === '1' && rel2 === '1') {
    return validateOneToOne(table1, table2, endpoint1, endpoint2, env);
  }
  if (rel1 === '*' && rel2 === '1') {
    return validateManyToOne(table1, table2, endpoint1, endpoint2, env);
  }
  if (rel1 === '1' && rel2 === '*') {
    return validateManyToOne(table2, table1, endpoint2, endpoint1, env);
  }
  if (rel1 === '*' && rel2 === '*') {
    return validateManyToMany(table1, table2, endpoint1, endpoint2, env);
  }

  return [];
}

/**
 * Validate 1-1 relationship: both directions must be valid.
 */
function validateOneToOne (
  table1: Table,
  table2: Table,
  endpoint1: RefEndpoint,
  endpoint2: RefEndpoint,
  env: InterpreterDatabase,
): CompileError[] {
  return [
    ...validateForeignKeyDirection(table1, table2, endpoint1, endpoint2, env),
    ...validateForeignKeyDirection(table2, table1, endpoint2, endpoint1, env),
  ];
}

/**
 * Validate *-1 relationship: many side must reference valid keys on one side.
 */
function validateManyToOne (
  manyTable: Table,
  oneTable: Table,
  manyEndpoint: RefEndpoint,
  oneEndpoint: RefEndpoint,
  env: InterpreterDatabase,
): CompileError[] {
  return validateForeignKeyDirection(manyTable, oneTable, manyEndpoint, oneEndpoint, env);
}

/**
 * Validate *-* relationship: both directions must be valid.
 */
function validateManyToMany (
  table1: Table,
  table2: Table,
  endpoint1: RefEndpoint,
  endpoint2: RefEndpoint,
  env: InterpreterDatabase,
): CompileError[] {
  return [
    ...validateForeignKeyDirection(table1, table2, endpoint1, endpoint2, env),
    ...validateForeignKeyDirection(table2, table1, endpoint2, endpoint1, env),
  ];
}

/**
 * Validate FK in one direction: source table values must exist in target table.
 */
function validateForeignKeyDirection (
  sourceTable: Table,
  targetTable: Table,
  sourceEndpoint: RefEndpoint,
  targetEndpoint: RefEndpoint,
  env: InterpreterDatabase,
): CompileError[] {
  const errors: CompileError[] = [];
  const sourceRows = env.records.get(sourceTable) || [];

  // Early exit if source has no rows
  if (sourceRows.length === 0) return errors;

  // Get merged tables and check columns exist
  const sourceMerged = mergeTableAndPartials(sourceTable, env);
  const targetMerged = mergeTableAndPartials(targetTable, env);

  const sourceColumns = new Set(sourceMerged.fields.map((f) => f.name));
  const targetColumns = new Set(targetMerged.fields.map((f) => f.name));

  if (sourceEndpoint.fieldNames.some((col) => !sourceColumns.has(col))) return errors;
  if (targetEndpoint.fieldNames.some((col) => !targetColumns.has(col))) return errors;

  // Collect valid keys from target table
  const validKeys = collectValidKeys(targetTable, targetEndpoint.fieldNames, env);

  // Check each source row
  for (const row of sourceRows) {
    // Skip rows with NULL in FK columns (NULLs don't participate in FK checks)
    if (hasNullWithoutDefaultInKey(row.values, sourceEndpoint.fieldNames)) continue;

    const key = extractKeyValueWithDefault(row.values, sourceEndpoint.fieldNames);
    if (!validKeys.has(key)) {
      errors.push(...createForeignKeyViolationErrors(
        row,
        sourceEndpoint,
        targetEndpoint,
        sourceMerged,
        targetMerged,
      ));
    }
  }

  return errors;
}

/**
 * Create error for FK violation.
 */
function createForeignKeyViolationErrors (
  row: TableRecordRow,
  sourceEndpoint: RefEndpoint,
  targetEndpoint: RefEndpoint,
  sourceTable: { schemaName: string | null; name: string },
  targetTable: { schemaName: string | null; name: string },
): CompileError[] {
  const errorNodes = sourceEndpoint.fieldNames
    .map((col) => row.columnNodes[col])
    .filter(Boolean);

  const isComposite = sourceEndpoint.fieldNames.length > 1;
  const sourceColumnRef = formatFullColumnNames(
    sourceTable.schemaName,
    sourceTable.name,
    sourceEndpoint.fieldNames,
  );
  const targetColumnRef = formatFullColumnNames(
    targetTable.schemaName,
    targetTable.name,
    targetEndpoint.fieldNames,
  );

  let msg: string;
  if (isComposite) {
    const valueStr = sourceEndpoint.fieldNames
      .map((col) => JSON.stringify(row.values[col]?.value))
      .join(', ');
    msg = `FK violation: ${sourceColumnRef} = (${valueStr}) does not exist in ${targetColumnRef}`;
  } else {
    const value = JSON.stringify(row.values[sourceEndpoint.fieldNames[0]]?.value);
    msg = `FK violation: ${sourceColumnRef} = ${value} does not exist in ${targetColumnRef}`;
  }

  if (errorNodes.length > 0) {
    return errorNodes.map((node) => new CompileError(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      msg,
      node,
    ));
  }

  return [new CompileError(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    msg,
    row.node,
  )];
}
