import { RecordValue, Column } from '@/core/interpreter/types';
import { isSerialType } from '../data';

// Given a set of columns and a row
// Return a string contain the values of the columns joined together with `|` -> This string is used for deduplication
// Note that we do not take autoincrement into account, as we cannot know its value
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

export function hasNullInKey (
  row: Record<string, RecordValue>,
  columnNames: string[],
  columns?: (Column | undefined)[],
): boolean {
  return columnNames.some((name, idx) => {
    const value = row[name]?.value;

    // If value is null/undefined but column has default, it's not null
    if ((value === null || value === undefined) && columns && columns[idx]) {
      const column = columns[idx];
      if (column?.dbdefault) {
        return false; // Has default, so not null
      }
    }

    return value === null || value === undefined;
  });
}

// Check if column is an auto-increment column (serial types or increment flag)
export function isAutoIncrementColumn (column: Column): boolean {
  return column.increment || isSerialType(column.type.type_name);
}

// Check if column has NOT NULL constraint with a default value
export function hasNotNullWithDefault (column: Column): boolean {
  return (column.not_null || false) && !!column.dbdefault;
}

// Format full column name with schema and table
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

// Format full column names for single or composite constraints
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
