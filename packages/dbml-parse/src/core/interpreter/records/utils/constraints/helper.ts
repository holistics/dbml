import { RecordValue, Column, TableRecordRow } from '@/core/interpreter/types';
import { isSerialType } from '../data';
import { CompileError, CompileErrorCode } from '@/core/errors';

export function extractKeyValueWithDefault (
  row: Record<string, RecordValue>,
  columnNames: string[],
  columns?: (Column | undefined)[],
): string {
  return columnNames.map((name, idx) => {
    const value = row[name]?.value;

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
  row: Record<string, RecordValue>,
  columnNames: string[],
  columns?: (Column | undefined)[],
): boolean {
  return columnNames.some((name, idx) => {
    const value = row[name]?.value;

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
  schemaName: string | null,
  tableName: string,
  columnName: string,
): string {
  if (schemaName) {
    return `${schemaName}.${tableName}.${columnName}`;
  }
  return `${tableName}.${columnName}`;
}

export function formatFullColumnNames (
  schemaName: string | null,
  tableName: string,
  columnNames: string[],
): string {
  if (columnNames.length === 1) {
    return formatFullColumnName(schemaName, tableName, columnNames[0]);
  }
  const formatted = columnNames.map((col) => formatFullColumnName(schemaName, tableName, col));
  return `(${formatted.join(', ')})`;
}

export function formatValues (
  row: Record<string, RecordValue>,
  columnNames: string[],
): string {
  if (columnNames.length === 1) {
    return JSON.stringify(row[columnNames[0]]?.value);
  }
  const values = columnNames.map((col) => JSON.stringify(row[col]?.value)).join(', ');
  return `(${values})`;
}

export function createConstraintErrors (
  row: TableRecordRow,
  columnNames: string[],
  message: string,
): CompileError[] {
  const errorNodes = columnNames
    .map((col) => row.columnNodes[col])
    .filter(Boolean);

  if (errorNodes.length > 0) {
    return errorNodes.map((node) => new CompileError(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      message,
      node,
    ));
  }

  return [new CompileError(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    message,
    row.node,
  )];
}
