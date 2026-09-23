/*
 * Records validation diagnostics
 *
 * Reports type mismatches and constraint violations found when validating
 * record data against column definitions. Covers type validation (null,
 * enum, numeric, boolean, datetime, string) and constraint checks
 * (PK null/duplicate/missing, FK null/existence, unique duplicate).
 */

import type Compiler from '@/compiler';
import { CompileErrorCode, CompileInfo, DiagnosticCategory } from '@/core/types/errors';
import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import type { ColumnSymbol } from '@/core/types/symbol';
import type { Filepath } from '@/core/types/filepath';
import type { TableSymbol } from '@/core/types/symbol/symbols';

function formatColumnRef (
  compiler: Compiler,
  table: TableSymbol,
  columns: ColumnSymbol[],
  filepath?: Filepath,
): string {
  const { schema, name: tableName } = filepath
    ? table.interpretedName(compiler, filepath)
    : { schema: table.schema(compiler), name: table.name ?? '' };
  const names = columns.map((c) => {
    const col = c.name ?? '';
    return schema ? `${schema}.${tableName}.${col}` : `${tableName}.${col}`;
  });
  return names.length === 1 ? names[0] : `(${names.join(', ')})`;
}

function constraintLabel (columns: ColumnSymbol[], kind: string): string {
  return columns.length > 1 ? `Composite ${kind}` : kind;
}

/* Type validation */

// NULL value in a NOT NULL column with no default or auto-increment.
export function recordsNullNotAllowed (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string; // column name, e.g. 'user_id'
  },
): CompileInfo {
  const { colName } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `NULL not allowed for NOT NULL column \`${colName}\` without a default value or auto-increment`,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` is marked NOT NULL and has no default value or auto-increment.` },
  );
}

// Value doesn't match any member of the enum type.
export function recordsInvalidEnum (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
  },
): CompileInfo {
  const { colName } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Invalid enum value for column \`${colName}\``,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` uses an enum type. The value must match one of the defined enum members.` },
  );
}

// Value is not a valid number for a numeric column.
export function recordsInvalidNumeric (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
    typeName: string; // e.g. 'int', 'decimal'
  },
): CompileInfo {
  const { colName, typeName } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Invalid numeric value for column \`${colName}\``,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` has type \`${typeName}\` which expects a numeric value. Provide a valid integer or decimal.` },
  );
}

// Decimal value provided for an integer column.
export function recordsInvalidInteger (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
    value: number; // the decimal value provided
  },
): CompileInfo {
  const { colName, value } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Invalid integer value \`${value}\` for column \`${colName}\`: expected integer, got decimal`,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` is an integer column and cannot store decimal values.` },
  );
}

// Numeric value exceeds the column's precision.
export function recordsExceedsPrecision (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
    typeName: string; // e.g. 'decimal'
    value: number;
    precision: number;
    scale: number;
    totalDigits: number;
  },
): CompileInfo {
  const { colName, typeName, value, precision, scale, totalDigits } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Numeric value \`${value}\` for column \`${colName}\` exceeds precision: expected at most ${precision} total digits, got ${totalDigits}`,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` is defined as \`${typeName}(${precision},${scale})\`, allowing at most ${precision} total digits. The value \`${value}\` has ${totalDigits}.` },
  );
}

// Numeric value exceeds the column's scale (decimal places).
export function recordsExceedsScale (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
    typeName: string;
    value: number;
    precision: number;
    scale: number;
    decimalDigits: number;
  },
): CompileInfo {
  const { colName, typeName, value, precision, scale, decimalDigits } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Numeric value \`${value}\` for column \`${colName}\` exceeds scale: expected at most ${scale} decimal digits, got ${decimalDigits}`,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` is defined as \`${typeName}(${precision},${scale})\`, allowing at most ${scale} decimal places. The value \`${value}\` has ${decimalDigits}.` },
  );
}

// Value is not a valid boolean.
export function recordsInvalidBoolean (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
  },
): CompileInfo {
  const { colName } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Invalid boolean value for column \`${colName}\``,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` is a boolean column. Use \`true\`/\`false\`, \`1\`/\`0\`, or \`'yes'\`/\`'no'\`.` },
  );
}

// Value is not a valid datetime format.
export function recordsInvalidDatetime (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
  },
): CompileInfo {
  const { colName } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Invalid datetime value for column \`${colName}\``,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` expects a date or time value. Supported formats include \`'YYYY-MM-DD'\`, \`'HH:MM:SS'\`, \`'YYYY-MM-DD HH:MM:SS'\`, \`'MM/DD/YYYY'\`, \`'D MMM YYYY'\`, or \`'MMM D, YYYY'\`.` },
  );
}

// Value is not a valid string (not quoted).
export function recordsInvalidString (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
  },
): CompileInfo {
  const { colName } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Invalid string value for column \`${colName}\``,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` is a string column. Values must be wrapped in quotes.` },
  );
}

// String value exceeds the column's maximum byte length.
export function recordsStringTooLong (
  node: SyntaxNode | SyntaxToken,
  options: {
    colName: string;
    typeName: string; // e.g. 'varchar'
    typeArg: string; // e.g. '50'
    maxLength: number;
    actualLength: number;
  },
): CompileInfo {
  const { colName, typeName, typeArg, maxLength, actualLength } = options;
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `String value for column \`${colName}\` exceeds maximum length: expected at most ${maxLength} bytes (UTF-8), got ${actualLength} bytes`,
    node,
    { category: DiagnosticCategory.RecordValueTypeMismatch, explanation: `\`${colName}\` is defined as \`${typeName}(${typeArg})\`, limiting values to ${maxLength} bytes in UTF-8 encoding. The provided value uses ${actualLength} bytes.` },
  );
}

/* Constraint validation */

// NULL value in a primary key column.
export function recordsPkNull (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    table: TableSymbol;
    columns: ColumnSymbol[];
  },
): CompileInfo {
  const { table, columns } = options;
  const columnRef = formatColumnRef(compiler, table, columns);
  const label = constraintLabel(columns, 'PK');
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `NULL in ${label}: \`${columnRef}\` cannot be NULL`,
    node,
    { category: DiagnosticCategory.RecordConstraintViolation, explanation: `\`${columnRef}\` is a primary key and cannot be NULL.` },
  );
}

// Duplicate value in a primary key column.
export function recordsPkDuplicate (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    table: TableSymbol;
    columns: ColumnSymbol[];
    valueStr: string; // e.g. '1' or '(1, "US")'
  },
): CompileInfo {
  const { table, columns, valueStr } = options;
  const columnRef = formatColumnRef(compiler, table, columns);
  const label = constraintLabel(columns, 'PK');
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Duplicate ${label}: \`${columnRef}\` = \`${valueStr}\``,
    node,
    { category: DiagnosticCategory.RecordConstraintViolation, explanation: `\`${columnRef}\` is a primary key and must be unique across all rows.` },
  );
}

// PK column missing from records block with no default or auto-increment.
export function recordsPkMissing (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    table: TableSymbol;
    columns: ColumnSymbol[];
  },
): CompileInfo {
  const { table, columns } = options;
  const columnRef = formatColumnRef(compiler, table, columns);
  const label = constraintLabel(columns, 'PK');
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `${label}: Column \`${columnRef}\` is missing from record and has no default value`,
    node,
    { category: DiagnosticCategory.RecordConstraintViolation, explanation: `\`${columnRef}\` is a primary key with no default or auto-increment, so it must be specified in the records block.` },
  );
}

// FK column is null but the relationship requires a value.
export function recordsFkNull (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    leftTable: TableSymbol;
    leftColumns: ColumnSymbol[];
    rightTable: TableSymbol;
    rightColumns: ColumnSymbol[];
    filepath: Filepath;
    valueStr: string;
  },
): CompileInfo {
  const { leftTable, leftColumns, rightTable, rightColumns, filepath, valueStr } = options;
  const leftRef = formatColumnRef(compiler, leftTable, leftColumns, filepath);
  const rightRef = formatColumnRef(compiler, rightTable, rightColumns, filepath);
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `FK violation: \`${leftRef}\` = \`${valueStr}\` must not be NULL`,
    node,
    { category: DiagnosticCategory.RecordConstraintViolation, explanation: `\`${leftRef}\` references \`${rightRef}\`, so every row must have a non-null value.` },
  );
}

// FK value doesn't exist in the referenced table.
export function recordsFkNotFound (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    leftTable: TableSymbol;
    leftColumns: ColumnSymbol[];
    rightTable: TableSymbol;
    rightColumns: ColumnSymbol[];
    filepath: Filepath;
    valueStr: string;
  },
): CompileInfo {
  const { leftTable, leftColumns, rightTable, rightColumns, filepath, valueStr } = options;
  const leftRef = formatColumnRef(compiler, leftTable, leftColumns, filepath);
  const rightRef = formatColumnRef(compiler, rightTable, rightColumns, filepath);
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `FK violation: \`${leftRef}\` = \`${valueStr}\` does not exist in \`${rightRef}\``,
    node,
    { category: DiagnosticCategory.RecordConstraintViolation, explanation: `\`${leftRef}\` is a foreign key referencing \`${rightRef}\`. Every non-null value in an FK must match an existing row in the referenced column.` },
  );
}

// Duplicate value in a unique column.
export function recordsUniqueDuplicate (
  compiler: Compiler,
  node: SyntaxNode | SyntaxToken,
  options: {
    table: TableSymbol;
    columns: ColumnSymbol[];
    valueStr: string;
  },
): CompileInfo {
  const { table, columns, valueStr } = options;
  const columnRef = formatColumnRef(compiler, table, columns);
  const label = constraintLabel(columns, 'UNIQUE');
  return new CompileInfo(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    `Duplicate ${label}: \`${columnRef}\` = \`${valueStr}\``,
    node,
    { category: DiagnosticCategory.RecordConstraintViolation, explanation: `\`${columnRef}\` has a unique constraint, so no two rows can have the same value.` },
  );
}
