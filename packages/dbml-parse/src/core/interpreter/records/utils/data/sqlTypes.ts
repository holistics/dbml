import {
  CallExpressionNode,
  FunctionApplicationNode,
} from '@/core/parser/nodes';
import { extractNumericLiteral } from '@/core/analyzer/utils';
import { ColumnSymbol } from '@/core/analyzer/symbol/symbols';

// Type category lists
const INTEGER_TYPES = [
  'int', 'integer', 'smallint', 'bigint', 'tinyint', 'mediumint',
  'serial', 'bigserial', 'smallserial',
];

const FLOAT_TYPES = [
  'decimal', 'numeric', 'real', 'float', 'double', 'double precision',
  'number',
];

const STRING_TYPES = [
  'varchar', 'char', 'character', 'character varying', 'nvarchar', 'nchar',
  'text', 'ntext', 'tinytext', 'mediumtext', 'longtext',
];

const BINARY_TYPES = [
  'binary', 'varbinary', 'blob', 'tinyblob', 'mediumblob', 'longblob',
  'bytea',
];

const BOOL_TYPES = [
  'bool', 'boolean', 'bit',
];

const DATETIME_TYPES = [
  'date', 'datetime', 'datetime2', 'smalldatetime',
  'timestamp', 'timestamptz', 'timestamp with time zone', 'timestamp without time zone',
  'time', 'timetz', 'time with time zone', 'time without time zone',
];

// Normalize a type name (lowercase, trim, collapse spaces)
export function normalizeTypeName (type: string): string {
  return type.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Check if a type is an integer type
export function isIntegerType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return INTEGER_TYPES.includes(normalized);
}

// Check if a type is a float type
export function isFloatType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return FLOAT_TYPES.includes(normalized);
}

// Check if a type is numeric (integer or float)
export function isNumericType (type: string): boolean {
  return isIntegerType(type) || isFloatType(type);
}

// Check if a type is boolean
export function isBooleanType (type: string): boolean {
  return BOOL_TYPES.includes(type);
}

// Check if a type is a string type
export function isStringType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return STRING_TYPES.includes(normalized);
}

// Check if a type is a binary type
export function isBinaryType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return BINARY_TYPES.includes(normalized);
}

// Check if a type is a datetime type
export function isDateTimeType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return DATETIME_TYPES.includes(normalized);
}

// Check if a type is a time-only type (no date component)
export function isTimeOnlyType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return normalized === 'time' || normalized === 'timetz'
    || normalized === 'time with time zone' || normalized === 'time without time zone';
}

// Check if a type is a date-only type (no time component)
export function isDateOnlyType (type: string): boolean {
  const normalized = normalizeTypeName(type);
  return normalized === 'date';
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

// Check if a value fits within precision and scale for DECIMAL/NUMERIC types
// - precision: total number of digits (both sides of decimal point)
// - scale: number of digits after the decimal point
// Example: DECIMAL(5, 2) allows 123.45 but not 1234.5 (too many int digits) or 12.345 (too many decimal digits)
export function fitsInPrecisionScale (value: number, precision: number, scale: number): boolean {
  const absValue = Math.abs(value);
  const intPart = Math.trunc(absValue);
  const intPartLength = intPart === 0 ? 1 : Math.floor(Math.log10(intPart)) + 1;
  const maxIntDigits = precision - scale;

  if (intPartLength > maxIntDigits) {
    return false;
  }

  const strValue = absValue.toString();
  const dotIndex = strValue.indexOf('.');
  if (dotIndex !== -1) {
    const decimalPart = strValue.substring(dotIndex + 1);
    if (decimalPart.length > scale) {
      return false;
    }
  }

  return true;
}

// Get the record value type based on SQL type
// Returns: 'string' | 'bool' | 'integer' | 'real' | 'date' | 'time' | 'datetime' | original type
export function getRecordValueType (sqlType: string, isEnum: boolean): string {
  if (isEnum) return 'string';
  if (isIntegerType(sqlType)) return 'integer';
  if (isFloatType(sqlType)) return 'real';
  if (isBooleanType(sqlType)) return 'bool';
  if (isStringType(sqlType)) return 'string';
  if (isBinaryType(sqlType)) return 'string';
  if (isDateOnlyType(sqlType)) return 'date';
  if (isTimeOnlyType(sqlType)) return 'time';
  if (isDateTimeType(sqlType)) return 'datetime';
  return sqlType; // Keep original type if not recognized
}
