import type Compiler from '@/compiler/index';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { CompileErrorCode, CompileWarning } from '@/core/types/errors';
import type { RecordValue } from '@/core/types/schemaJson';
import type { TableRecord } from '@/core/types/schemaJson';
import type { ColumnSymbol } from '@/core/types/symbol';

// Convert positional TableRecord rows to keyed rows (column name -> value)
export function toKeyedRows (record: TableRecord): Record<string, RecordValue>[] {
  return record.values.map((row) => {
    const keyed: Record<string, RecordValue> = {};
    record.columns.forEach((col, i) => { keyed[col] = row[i]; });
    return keyed;
  });
}

export function makeTableKey (schema: string | null, table: string): string {
  return schema ? `${schema}.${table}` : `${DEFAULT_SCHEMA_NAME}.${table}`;
}

export function extractKeyValueWithDefault (
  compiler: Compiler,
  row: Record<string, RecordValue>,
  columns: ColumnSymbol[],
): string {
  return columns.map((col) => {
    const name = col.name ?? '';
    const value = row[name]?.value;

    if (value === null || value === undefined) {
      const dbdefault = col.default(compiler);
      if (dbdefault) {
        return JSON.stringify(dbdefault.value);
      }
    }

    return JSON.stringify(value);
  }).join('|');
}

export function hasNullWithoutDefaultInKey (
  compiler: Compiler,
  row: Record<string, RecordValue>,
  columns: ColumnSymbol[],
): boolean {
  return columns.some((col) => {
    const name = col.name ?? '';
    const value = row[name]?.value;

    if (value === null || value === undefined) {
      const dbdefault = col.default(compiler);
      if (dbdefault) {
        return false;
      }
    }

    return value === null || value === undefined;
  });
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

// Format values to put in error messages
// e.g. 1 -> '1'
// e.g. 'a' -> '"a"'
// e.g. 1, 'a' -> '(1, "a")'
// Falls back to column default when the column is unspecified in the row.
export function formatValues (
  compiler: Compiler,
  row: Record<string, RecordValue>,
  columns: ColumnSymbol[],
): string {
  const values = columns.map((col) => {
    const name = col.name ?? '';
    const value = row[name] !== undefined ? row[name].value : col.default(compiler)?.value;
    return JSON.stringify(value);
  }).join(', ');
  return columns.length === 1 ? values : `(${values})`;
}

// Get anchor values for a warning from a row.
// Tries the specified columns first; falls back to all columns in the row.
export function getDiagnosticAnchorValues (
  row: Record<string, RecordValue>,
  columnNames: string[],
): RecordValue[] {
  const present = columnNames.filter((col) => row[col]).map((col) => row[col]);
  return present.length > 0 ? present : Object.values(row).filter(Boolean);
}

// Create a compile warning anchored to the AST node at a record value's position.
export function createConstraintWarning (
  compiler: Compiler,
  recordValue: RecordValue,
  message: string,
): CompileWarning {
  const {
    token,
  } = recordValue;
  const node = compiler.nodeAtPosition(token.filepath, token.start.offset)
    ?? compiler.parse.ast(token.filepath);
  return new CompileWarning(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    message,
    node,
  );
}
