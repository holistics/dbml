import {
  CompileErrorCode, CompileWarning,
} from '@/core/types/errors';
import type {
  Column, RecordValue, TableRecord,
} from '@/core/types/schemaJson';
import {
  isSerialType,
} from '../data';

export function buildColumnIndex (record: TableRecord): Map<string, number> {
  const index = new Map<string, number>();
  for (let i = 0; i < record.columns.length; i++) {
    index.set(record.columns[i], i);
  }
  return index;
}

export function extractKeyValueWithDefault (
  row: RecordValue[],
  columnNames: string[],
  columnIndex: Map<string, number>,
  columns?: (Column | undefined)[],
): string {
  return columnNames.map((name, idx) => {
    const colIdx = columnIndex.get(name);
    const value = colIdx !== undefined ? row[colIdx]?.value : undefined;

    if ((value === null || value === undefined) && columns && columns[idx]) {
      const column = columns[idx];
      if (column?.dbdefault) {
        return JSON.stringify(column.dbdefault.value);
      }
    }

    return JSON.stringify(value);
  }).join('|');
}

export function hasNullWithoutDefaultInKey (
  row: RecordValue[],
  columnNames: string[],
  columnIndex: Map<string, number>,
  columns?: (Column | undefined)[],
): boolean {
  return columnNames.some((name, idx) => {
    const colIdx = columnIndex.get(name);
    const value = colIdx !== undefined ? row[colIdx]?.value : undefined;

    if ((value === null || value === undefined) && columns && columns[idx]) {
      const column = columns[idx];
      if (column?.dbdefault) {
        return false;
      }
    }

    return value === null || value === undefined;
  });
}

export function isAutoIncrementColumn (column: Column): boolean {
  return column.increment || isSerialType(column.type.type_name);
}

export function hasNotNullWithDefault (column: Column): boolean {
  return (column.not_null || false) && !!column.dbdefault;
}

export function formatFullColumnName (
  schemaName: string | null | undefined,
  tableName: string,
  columnName: string,
): string {
  if (schemaName) {
    return `${schemaName}.${tableName}.${columnName}`;
  }
  return `${tableName}.${columnName}`;
}

export function formatFullColumnNames (
  schemaName: string | null | undefined,
  tableName: string,
  columnNames: string[],
): string {
  if (columnNames.length === 1) {
    return formatFullColumnName(schemaName, tableName, columnNames[0]);
  }
  const formatted = columnNames.map((col) => formatFullColumnName(schemaName, tableName, col));
  return `(${formatted.join(', ')})`;
}

// Format values to put in error messages
// e.g. 1 -> '1'
// e.g. 'a' -> '"a"'
// e.g. 1, 'a' -> '(1, "a")'
export function formatValues (
  row: RecordValue[],
  columnNames: string[],
  columnIndex: Map<string, number>,
): string {
  if (columnNames.length === 1) {
    const colIdx = columnIndex.get(columnNames[0]);
    return JSON.stringify(colIdx !== undefined ? row[colIdx]?.value : null);
  }
  const values = columnNames.map((col) => {
    const colIdx = columnIndex.get(col);
    return JSON.stringify(colIdx !== undefined ? row[colIdx]?.value : null);
  }).join(', ');
  return `(${values})`;
}

export {
  createConstraintWarnings as createConstraintErrors,
};

/**
 * Create constraint warnings for a record.
 * Uses the record's token as location since we don't have per-row nodes.
 */
export function createConstraintWarnings (
  record: TableRecord,
  message: string,
): CompileWarning[] {
  return [
    new CompileWarning(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      message,
      record as any,
    ),
  ];
}
