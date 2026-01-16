import { RecordValue, Column } from '@/core/interpreter/types';
import { normalizeTypeName, SERIAL_TYPES } from '../data';

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

// Format column names for error messages
// Single column: 'id'
// Composite: (id, name)
export function formatColumns (columnNames: string[]): string {
  if (columnNames.length === 1) {
    return `'${columnNames[0]}'`;
  }
  return `(${columnNames.join(', ')})`;
}

// Check if column is an auto-increment column (serial types or increment flag)
export function isAutoIncrementColumn (column: Column): boolean {
  const normalizedType = normalizeTypeName(column.type.type_name);
  return column.increment || SERIAL_TYPES.has(normalizedType);
}

// Check if column has NOT NULL constraint with a default value
export function hasNotNullWithDefault (column: Column): boolean {
  return (column.not_null || false) && !!column.dbdefault;
}
