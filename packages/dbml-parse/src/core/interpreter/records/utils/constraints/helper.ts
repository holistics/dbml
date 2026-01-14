import { RecordValue } from '@/core/interpreter/types';
import { ColumnSchema } from '../../types';

// Serial types that auto-generate values
const SERIAL_TYPES = new Set(['serial', 'smallserial', 'bigserial']);

// Get column indices for a set of column names
export function getColumnIndices (columns: string[], columnNames: string[]): number[] {
  return columnNames.map((name) => columns.indexOf(name));
}

// Extract composite key value from a row
export function extractKeyValue (row: RecordValue[], indices: number[]): string {
  return indices.map((i) => JSON.stringify(row[i]?.value)).join('|');
}

// Extract composite key value from a row, resolving NULL to default values
export function extractKeyValueWithDefaults (
  row: RecordValue[],
  indices: number[],
  columnSchemas: (ColumnSchema | undefined)[],
): string {
  return indices.map((i, idx) => {
    const value = row[i]?.value;
    const schema = columnSchemas[idx];

    // If value is NULL and column has a default, use the default
    if ((value === null || value === undefined) && schema?.dbdefault) {
      return JSON.stringify(schema.dbdefault.value);
    }

    return JSON.stringify(value);
  }).join('|');
}

// Check if any value in the key is null
export function hasNullInKey (row: RecordValue[], indices: number[]): boolean {
  return indices.some((i) => row[i]?.value === null || row[i]?.value === undefined);
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
export function isAutoIncrementColumn (schema: ColumnSchema): boolean {
  const typeLower = schema.type.toLowerCase();
  return schema.increment || SERIAL_TYPES.has(typeLower);
}

// Check if column has NOT NULL constraint with a default value
export function hasNotNullWithDefault (schema: ColumnSchema): boolean {
  return schema.notNull && !!schema.dbdefault;
}
