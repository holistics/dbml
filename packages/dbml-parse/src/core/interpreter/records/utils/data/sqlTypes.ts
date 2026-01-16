import {
  CallExpressionNode,
  FunctionApplicationNode,
} from '@/core/parser/nodes';
import { extractNumericLiteral } from '@/core/analyzer/utils';
import { ColumnSymbol } from '@/core/analyzer/symbol/symbols';

export const INTEGER_TYPES = new Set([
  'int', 'integer', 'smallint', 'bigint', 'tinyint', 'mediumint',
  'serial', 'bigserial', 'smallserial',
]);

export const FLOAT_TYPES = new Set([
  'decimal', 'numeric', 'real', 'float', 'double', 'double precision',
  'number',
]);

export const STRING_TYPES = new Set([
  'varchar', 'char', 'character', 'character varying', 'nvarchar', 'nchar',
  'text', 'ntext', 'tinytext', 'mediumtext', 'longtext',
]);

export const BINARY_TYPES = new Set([
  'binary', 'varbinary', 'blob', 'tinyblob', 'mediumblob', 'longblob',
  'bytea',
]);

export const BOOL_TYPES = new Set([
  'bool', 'boolean', 'bit',
]);

export const DATETIME_TYPES = new Set([
  'date', 'datetime', 'datetime2', 'smalldatetime',
  'timestamp', 'timestamptz', 'timestamp with time zone', 'timestamp without time zone',
  'time', 'timetz', 'time with time zone', 'time without time zone',
]);

export const SERIAL_TYPES = new Set(['serial', 'smallserial', 'bigserial']);

// Normalize a type name (lowercase, trim, collapse spaces)
export function normalizeTypeName (type: string): string {
  return type.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function isIntegerType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return INTEGER_TYPES.has(normalized);
}

export function isFloatType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return FLOAT_TYPES.has(normalized);
}

export function isNumericType (type: string): boolean {
  return isIntegerType(type) || isFloatType(type);
}

export function isBooleanType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return BOOL_TYPES.has(normalized);
}

export function isStringType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return STRING_TYPES.has(normalized);
}

export function isBinaryType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return BINARY_TYPES.has(normalized);
}

export function isDateTimeType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return DATETIME_TYPES.has(normalized);
}

// Get type node from a column symbol's declaration
function getTypeNode (columnSymbol: ColumnSymbol) {
  const declaration = columnSymbol.declaration;
  if (!(declaration instanceof FunctionApplicationNode)) {
    return null;
  }
  return declaration.args[0] || null;
}

// Get numeric type parameters (precision, scale) from a column (e.g., decimal(10, 2))
export function getNumericTypeParams (columnSymbol: ColumnSymbol): { precision?: number; scale?: number } {
  const typeNode = getTypeNode(columnSymbol);
  if (!(typeNode instanceof CallExpressionNode)) return {};
  if (!typeNode.argumentList || typeNode.argumentList.elementList.length !== 2) return {};

  const precision = extractNumericLiteral(typeNode.argumentList.elementList[0]);
  const scale = extractNumericLiteral(typeNode.argumentList.elementList[1]);
  if (precision === null || scale === null) return {};

  return { precision: Math.trunc(precision), scale: Math.trunc(scale) };
}

// Get length type parameter from a column (e.g., varchar(255))
export function getLengthTypeParam (columnSymbol: ColumnSymbol): { length?: number } {
  const typeNode = getTypeNode(columnSymbol);
  if (!(typeNode instanceof CallExpressionNode)) return {};
  if (!typeNode.argumentList || typeNode.argumentList.elementList.length !== 1) return {};

  const length = extractNumericLiteral(typeNode.argumentList.elementList[0]);
  if (length === null) return {};

  return { length: Math.trunc(length) };
}

// Get the record value type based on SQL type
// Returns: 'string' | 'bool' | 'integer' | 'real' | 'date' | 'time' | 'datetime' | original type
export function getRecordValueType (sqlType: string, isEnum: boolean): string {
  if (isEnum) return 'string';
  if (isIntegerType(sqlType)) return 'integer';
  if (isFloatType(sqlType)) return 'real';
  if (isBooleanType(sqlType)) return 'bool';
  if (isStringType(sqlType)) return 'string';
  if (isDateTimeType(sqlType)) return 'datetime';
  return sqlType; // Keep original type if not recognized
}
