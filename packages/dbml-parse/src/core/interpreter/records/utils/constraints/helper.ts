import { RecordValue, Column } from '@/core/interpreter/types';

// Serial types that auto-generate values
const SERIAL_TYPES = new Set(['serial', 'smallserial', 'bigserial']);

// Extract composite key value from an object-based row
// For missing columns, use their default value if available
export function extractKeyValue (
  row: Record<string, RecordValue>,
  columnNames: string[],
  columns?: (Column | undefined)[],
): string {
  return columnNames.map((name, idx) => {
    const value = row[name]?.value;

    // If value is missing and we have column info with default, use the default
    if ((value === null || value === undefined) && columns && columns[idx]) {
      const column = columns[idx];
      if (column?.dbdefault) {
        return JSON.stringify(column.dbdefault.value);
      }
    }

    return JSON.stringify(value);
  }).join('|');
}

// Check if any value in the key is null (considering defaults)
// If a column is missing/null but has a default, it's not considered null
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
  const typeLower = column.type.type_name.toLowerCase();
  return column.increment || SERIAL_TYPES.has(typeLower);
}

// Check if column has NOT NULL constraint with a default value
export function hasNotNullWithDefault (column: Column): boolean {
  return (column.not_null || false) && !!column.dbdefault;
}
