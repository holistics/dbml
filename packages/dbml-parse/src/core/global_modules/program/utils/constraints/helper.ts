import type Compiler from '@/compiler/index';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  CompileErrorCode, CompileWarning,
} from '@/core/types/errors';
import type {
  RecordValue,
} from '@/core/types/schemaJson';
import type {
  TableRecord,
} from '@/core/types/schemaJson';
import {
  isSerialType,
} from '@/core/global_modules/records/utils/data';
import type {
  ColumnSymbol,
} from '@/core/types/symbol';

export interface ColumnInfo {
  name: string;
  pk: boolean;
  unique: boolean;
  increment: boolean;
  notNull: boolean;
  dbdefault?: { value: string | number;
    type: string; };
  typeName: string;
}

export function columnInfoFromSymbol (col: ColumnSymbol, compiler: Compiler): ColumnInfo {
  const type = col.type(compiler);
  const def = col.default(compiler);
  return {
    name: col.name ?? '',
    pk: col.pk(compiler),
    unique: col.unique(compiler),
    increment: col.increment(compiler),
    notNull: col.nullable(compiler) === false,
    dbdefault: def,
    typeName: type?.name ?? '',
  };
}

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
  row: Record<string, RecordValue>,
  columnNames: string[],
  columns?: (ColumnInfo | undefined)[],
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
  columns?: (ColumnInfo | undefined)[],
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

export function isAutoIncrementColumn (column: ColumnInfo): boolean {
  return column.increment || isSerialType(column.typeName);
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
