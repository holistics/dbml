import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase, Column, TableRecordRow } from '@/core/interpreter/types';
import {
  extractKeyValueWithDefault,
  hasNullWithoutDefaultInKey,
  formatFullColumnNames,
} from './helper';
import { mergeTableAndPartials } from '@/core/interpreter/utils';

export function validateUnique (
  env: InterpreterDatabase,
): CompileError[] {
  const errors: CompileError[] = [];

  for (const [table, rows] of env.records) {
    if (rows.length === 0) continue;

    const mergedTable = mergeTableAndPartials(table, env);
    const uniqueConstraints = collectUniqueConstraints(mergedTable);

    if (uniqueConstraints.length === 0) continue;

    const columnMap = new Map(mergedTable.fields.map((c) => [c.name, c]));

    for (const uniqueColumns of uniqueConstraints) {
      const uniqueFields = uniqueColumns.map((col) => columnMap.get(col)).filter(Boolean);

      const duplicateErrors = validateUniqueValues(
        rows,
        uniqueColumns,
        uniqueFields,
        mergedTable,
      );
      errors.push(...duplicateErrors);
    }
  }

  return errors;
}

/**
 * Collect all UNIQUE constraints from table definition.
 * Returns array of column name arrays (one per constraint).
 */
function collectUniqueConstraints (table: { fields: Column[]; indexes: { unique?: boolean; columns: { value: string }[] }[] }): string[][] {
  const constraints: string[][] = [];

  // Single-column UNIQUE from field definitions
  for (const field of table.fields) {
    if (field.unique) {
      constraints.push([field.name]);
    }
  }

  // Composite UNIQUE from index definitions
  for (const index of table.indexes) {
    if (index.unique) {
      constraints.push(index.columns.map((c) => c.value));
    }
  }

  return constraints;
}

/**
 * Validate that UNIQUE values are not duplicated.
 * NULL values are allowed in UNIQUE constraints and don't cause conflicts.
 */
function validateUniqueValues (
  rows: TableRecordRow[],
  uniqueColumns: string[],
  uniqueFields: (Column | undefined)[],
  table: { schemaName: string | null; name: string },
): CompileError[] {
  const errors: CompileError[] = [];
  const seen = new Map<string, number>(); // key -> first occurrence row index

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];
    const hasNull = hasNullWithoutDefaultInKey(row.values, uniqueColumns, uniqueFields);

    // NULL values don't participate in UNIQUE checks
    if (hasNull) continue;

    const keyValue = extractKeyValueWithDefault(row.values, uniqueColumns, uniqueFields);
    if (seen.has(keyValue)) {
      errors.push(...createDuplicateUniqueError(row, uniqueColumns, table));
    } else {
      seen.set(keyValue, rowIndex);
    }
  }

  return errors;
}

/**
 * Create error for duplicate UNIQUE value.
 */
function createDuplicateUniqueError (
  row: TableRecordRow,
  uniqueColumns: string[],
  table: { schemaName: string | null; name: string },
): CompileError[] {
  const errorNodes = uniqueColumns.map((col) => row.columnNodes[col]).filter(Boolean);
  const isComposite = uniqueColumns.length > 1;
  const constraintType = isComposite ? 'Composite UNIQUE' : 'UNIQUE';
  const columnRef = formatFullColumnNames(table.schemaName, table.name, uniqueColumns);

  let msg: string;
  if (isComposite) {
    const valueStr = uniqueColumns.map((col) => JSON.stringify(row.values[col]?.value)).join(', ');
    msg = `Duplicate ${constraintType}: ${columnRef} = (${valueStr})`;
  } else {
    const value = JSON.stringify(row.values[uniqueColumns[0]]?.value);
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
