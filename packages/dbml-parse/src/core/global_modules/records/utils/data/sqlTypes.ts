import {
  CallExpressionNode,
  FunctionApplicationNode,
} from '@/core/parser/nodes';
import { extractNumericLiteral } from '@/core/analyzer/utils';
import { ColumnSymbol } from '@/core/analyzer/symbol/symbols';

export type SqlDialect = 'mysql' | 'postgres' | 'mssql' | 'oracle' | 'snowflake';

// Dialect-specific type mappings
const DIALECT_INTEGER_TYPES: Record<SqlDialect, Set<string>> = {
  mysql: new Set(['int', 'integer', 'smallint', 'bigint', 'tinyint', 'mediumint']),
  postgres: new Set(['int', 'integer', 'smallint', 'bigint', 'serial', 'bigserial', 'smallserial']),
  mssql: new Set(['int', 'integer', 'smallint', 'bigint', 'tinyint']),
  oracle: new Set(['int', 'integer', 'smallint']),
  snowflake: new Set(['int', 'integer', 'smallint', 'bigint', 'tinyint']),
};

const DIALECT_FLOAT_TYPES: Record<SqlDialect, Set<string>> = {
  mysql: new Set(['decimal', 'numeric', 'float', 'double', 'real']),
  postgres: new Set(['decimal', 'numeric', 'real', 'float', 'double precision']),
  mssql: new Set(['decimal', 'numeric', 'real', 'float']),
  oracle: new Set(['number', 'decimal', 'numeric', 'float', 'real']),
  snowflake: new Set(['number', 'decimal', 'numeric', 'float', 'double', 'real']),
};

const DIALECT_BOOL_TYPES: Record<SqlDialect, Set<string>> = {
  mysql: new Set(['bool', 'boolean', 'bit']),
  postgres: new Set(['bool', 'boolean']),
  mssql: new Set(['bit']),
  oracle: new Set([]), // Oracle typically uses number(1)
  snowflake: new Set(['boolean']),
};

const DIALECT_STRING_TYPES: Record<SqlDialect, Set<string>> = {
  mysql: new Set(['varchar', 'char', 'text', 'tinytext', 'mediumtext', 'longtext', 'string']),
  postgres: new Set(['varchar', 'char', 'character', 'character varying', 'text', 'string']),
  mssql: new Set(['varchar', 'char', 'nvarchar', 'nchar', 'text', 'ntext', 'string']),
  oracle: new Set(['varchar', 'varchar2', 'char', 'nvarchar2', 'nchar', 'string']),
  snowflake: new Set(['varchar', 'char', 'text', 'string']),
};

const DIALECT_BINARY_TYPES: Record<SqlDialect, Set<string>> = {
  mysql: new Set(['binary', 'varbinary', 'blob', 'tinyblob', 'mediumblob', 'longblob']),
  postgres: new Set(['bytea']),
  mssql: new Set(['binary', 'varbinary']),
  oracle: new Set(['blob', 'raw']),
  snowflake: new Set(['binary', 'varbinary']),
};

const DIALECT_DATETIME_TYPES: Record<SqlDialect, Set<string>> = {
  mysql: new Set(['date', 'datetime', 'timestamp', 'time']),
  postgres: new Set(['date', 'timestamp', 'timestamptz', 'timestamp with time zone', 'timestamp without time zone', 'time', 'timetz', 'time with time zone', 'time without time zone']),
  mssql: new Set(['date', 'datetime', 'datetime2', 'smalldatetime', 'time']),
  oracle: new Set(['date', 'timestamp', 'timestamp with time zone', 'timestamp with local time zone']),
  snowflake: new Set(['date', 'datetime', 'timestamp', 'time']),
};

const DIALECT_SERIAL_TYPES: Record<SqlDialect, Set<string>> = {
  mysql: new Set([]),
  postgres: new Set(['serial', 'smallserial', 'bigserial']),
  mssql: new Set([]),
  oracle: new Set([]),
  snowflake: new Set([]),
};

// Normalize a type name (lowercase, trim, collapse spaces)
export function normalizeTypeName (type: string): string {
  return type.toLowerCase().trim().replace(/\s+/g, ' ');
}

export function isIntegerType (type: string, dialect?: SqlDialect): boolean {
  const normalized = normalizeTypeName(type);
  if (dialect) {
    return DIALECT_INTEGER_TYPES[dialect].has(normalized);
  }
  // Check if any dialect has this type
  return Object.values(DIALECT_INTEGER_TYPES).some((set) => set.has(normalized));
}

export function isFloatType (type: string, dialect?: SqlDialect): boolean {
  const normalized = normalizeTypeName(type);
  if (dialect) {
    return DIALECT_FLOAT_TYPES[dialect].has(normalized);
  }
  // Check if any dialect has this type
  return Object.values(DIALECT_FLOAT_TYPES).some((set) => set.has(normalized));
}

export function isNumericType (type: string, dialect?: SqlDialect): boolean {
  return isIntegerType(type, dialect) || isFloatType(type, dialect);
}

export function isBooleanType (type: string, dialect?: SqlDialect): boolean {
  const normalized = normalizeTypeName(type);
  if (dialect) {
    return DIALECT_BOOL_TYPES[dialect].has(normalized);
  }
  // Check if any dialect has this type
  return Object.values(DIALECT_BOOL_TYPES).some((set) => set.has(normalized));
}

export function isStringType (type: string, dialect?: SqlDialect): boolean {
  const normalized = normalizeTypeName(type);
  if (dialect) {
    return DIALECT_STRING_TYPES[dialect].has(normalized);
  }
  // Check if any dialect has this type
  return Object.values(DIALECT_STRING_TYPES).some((set) => set.has(normalized));
}

export function isBinaryType (type: string, dialect?: SqlDialect): boolean {
  const normalized = normalizeTypeName(type);
  if (dialect) {
    return DIALECT_BINARY_TYPES[dialect].has(normalized);
  }
  // Check if any dialect has this type
  return Object.values(DIALECT_BINARY_TYPES).some((set) => set.has(normalized));
}

export function isDateTimeType (type: string, dialect?: SqlDialect): boolean {
  const normalized = normalizeTypeName(type);
  if (dialect) {
    return DIALECT_DATETIME_TYPES[dialect].has(normalized);
  }
  // Check if any dialect has this type
  return Object.values(DIALECT_DATETIME_TYPES).some((set) => set.has(normalized));
}

export function isSerialType (type: string, dialect?: SqlDialect): boolean {
  const normalized = normalizeTypeName(type);
  if (dialect) {
    return DIALECT_SERIAL_TYPES[dialect].has(normalized);
  }
  // Check if any dialect has this type
  return Object.values(DIALECT_SERIAL_TYPES).some((set) => set.has(normalized));
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

  // Specific datetime type mapping
  const normalized = normalizeTypeName(sqlType);
  if (normalized === 'date') return 'date';
  if (normalized === 'time' || normalized === 'timetz' || normalized === 'time with time zone' || normalized === 'time without time zone') return 'time';
  if (isDateTimeType(sqlType)) return 'datetime';

  return sqlType; // Keep original type if not recognized
}
