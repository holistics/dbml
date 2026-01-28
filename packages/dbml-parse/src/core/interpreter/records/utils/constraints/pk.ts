import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase, Column, TableRecordRow } from '@/core/interpreter/types';
import {
  extractKeyValueWithDefault,
  hasNullWithoutDefaultInKey,
  isAutoIncrementColumn,
  formatFullColumnNames,
} from './helper';
import { mergeTableAndPartials } from '@/core/interpreter/utils';
import { isSerialType } from '../data';

export function validatePrimaryKey (
  env: InterpreterDatabase,
): CompileError[] {
  const errors: CompileError[] = [];

  for (const [table, rows] of env.records) {
    if (rows.length === 0) continue;

    const mergedTable = mergeTableAndPartials(table, env);
    const pkConstraints = collectPrimaryKeyConstraints(mergedTable);

    if (pkConstraints.length === 0) continue;

    const columnMap = new Map(mergedTable.fields.map((c) => [c.name, c]));
    const recordColumns = collectRecordColumns(rows);

    for (const pkColumns of pkConstraints) {
      const pkFields = pkColumns.map((col) => columnMap.get(col)).filter(Boolean);

      // Validate that required PK columns are present
      const missingErrors = validateMissingColumns(
        pkColumns,
        recordColumns,
        columnMap,
        mergedTable,
        rows,
      );
      errors.push(...missingErrors);
      if (missingErrors.length > 0) continue;

      // Validate NULL and uniqueness
      const valueErrors = validatePrimaryKeyValues(
        rows,
        pkColumns,
        pkFields,
        mergedTable,
      );
      errors.push(...valueErrors);
    }
  }

  return errors;
}

/**
 * Collect all primary key constraints from table definition.
 * Returns array of column name arrays (one per constraint).
 */
function collectPrimaryKeyConstraints (table: { fields: Column[]; indexes: { pk?: boolean; columns: { value: string }[] }[] }): string[][] {
  const constraints: string[][] = [];

  // Single-column PKs from field definitions
  for (const field of table.fields) {
    if (field.pk) {
      constraints.push([field.name]);
    }
  }

  // Composite PKs from index definitions
  for (const index of table.indexes) {
    if (index.pk) {
      constraints.push(index.columns.map((c) => c.value));
    }
  }

  return constraints;
}

/**
 * Collect all column names that appear in any record row.
 * Returns a Set for O(1) lookup performance.
 */
function collectRecordColumns (rows: TableRecordRow[]): Set<string> {
  const columns = new Set<string>();
  for (const row of rows) {
    for (const colName of Object.keys(row.values)) {
      columns.add(colName);
    }
  }
  return columns;
}

/**
 * Check if PK columns are missing from records and don't have defaults.
 */
function validateMissingColumns (
  pkColumns: string[],
  recordColumns: Set<string>,
  columnMap: Map<string, Column>,
  table: { schemaName: string | null; name: string },
  rows: TableRecordRow[],
): CompileError[] {
  const missingColumns = pkColumns.filter((col) => !recordColumns.has(col));
  if (missingColumns.length === 0) return [];

  // Filter to columns that don't have defaults or autoincrement
  const missingWithoutDefaults = missingColumns.filter((colName) => {
    const col = columnMap.get(colName);
    if (!col) return false;

    const hasDefault = col.dbdefault || col.increment || isSerialType(col.type.type_name);
    return !hasDefault;
  });

  if (missingWithoutDefaults.length === 0) return [];

  // Report error on all rows
  const isComposite = missingWithoutDefaults.length > 1;
  const constraintType = isComposite ? 'Composite PK' : 'PK';
  const columnRef = formatFullColumnNames(table.schemaName, table.name, missingWithoutDefaults);
  const msg = `${constraintType}: Column ${columnRef} is missing from record and has no default value`;

  return rows.map((row) => new CompileError(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    msg,
    row.node,
  ));
}

/**
 * Validate that PK values are not NULL and are unique.
 */
function validatePrimaryKeyValues (
  rows: TableRecordRow[],
  pkColumns: string[],
  pkFields: (Column | undefined)[],
  table: { schemaName: string | null; name: string },
): CompileError[] {
  const errors: CompileError[] = [];
  const seen = new Map<string, number>(); // key -> first occurrence row index

  // Check if all PK columns are auto-increment (can skip NULL checks)
  const allAutoIncrement = pkFields.every((col) => col && isAutoIncrementColumn(col));

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const hasNull = hasNullWithoutDefaultInKey(row.values, pkColumns, pkFields);

    if (hasNull) {
      // Auto-increment columns generate unique values, so NULLs are OK
      if (allAutoIncrement) continue;

      // Non-auto-increment PKs cannot be NULL
      errors.push(...createNullPrimaryKeyError(row, pkColumns, table));
      continue;
    }

    // Check for duplicate values
    const keyValue = extractKeyValueWithDefault(row.values, pkColumns, pkFields);
    if (seen.has(keyValue)) {
      errors.push(...createDuplicatePrimaryKeyError(row, pkColumns, table));
    } else {
      seen.set(keyValue, rowIndex);
    }
  }

  return errors;
}

/**
 * Create error for NULL value in non-nullable PK.
 */
function createNullPrimaryKeyError (
  row: TableRecordRow,
  pkColumns: string[],
  table: { schemaName: string | null; name: string },
): CompileError[] {
  const errorNodes = pkColumns.map((col) => row.columnNodes[col]).filter(Boolean);
  const isComposite = pkColumns.length > 1;
  const constraintType = isComposite ? 'Composite PK' : 'PK';
  const columnRef = formatFullColumnNames(table.schemaName, table.name, pkColumns);
  const msg = `NULL in ${constraintType}: ${columnRef} cannot be NULL`;

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

/**
 * Create error for duplicate PK value.
 */
function createDuplicatePrimaryKeyError (
  row: TableRecordRow,
  pkColumns: string[],
  table: { schemaName: string | null; name: string },
): CompileError[] {
  const errorNodes = pkColumns.map((col) => row.columnNodes[col]).filter(Boolean);
  const isComposite = pkColumns.length > 1;
  const constraintType = isComposite ? 'Composite PK' : 'PK';
  const columnRef = formatFullColumnNames(table.schemaName, table.name, pkColumns);

  let msg: string;
  if (isComposite) {
    const valueStr = pkColumns.map((col) => JSON.stringify(row.values[col]?.value)).join(', ');
    msg = `Duplicate ${constraintType}: ${columnRef} = (${valueStr})`;
  } else {
    const value = JSON.stringify(row.values[pkColumns[0]]?.value);
    msg = `Duplicate ${constraintType}: ${columnRef} = ${value}`;
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
