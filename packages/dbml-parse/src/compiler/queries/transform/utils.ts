import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { splitQualifiedIdentifier } from '../utils';
import { createTableSymbolIndex, createSchemaSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';
import type SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { TableSymbol } from '@/core/analyzer/symbol/symbols';

export type TableNameInput = string | { schema?: string; table: string };

/**
 * Normalizes a table name input to { schema, table } format.
 * Properly handles quoted identifiers with dots inside.
 */
export function normalizeTableName (input: TableNameInput): { schema: string; table: string } {
  if (typeof input !== 'string') {
    return {
      schema: input.schema ?? DEFAULT_SCHEMA_NAME,
      table: input.table,
    };
  }

  const parts = splitQualifiedIdentifier(input);

  if (parts.length === 0) {
    return {
      schema: DEFAULT_SCHEMA_NAME,
      table: '',
    };
  }

  if (parts.length === 1) {
    return {
      schema: DEFAULT_SCHEMA_NAME,
      table: parts[0],
    };
  }

  if (parts.length === 2) {
    return {
      schema: parts[0],
      table: parts[1],
    };
  }

  // More than 2 parts - treat the last as table, rest as schema
  const tablePart = parts[parts.length - 1];
  const schemaPart = parts.slice(0, -1).join('.');
  return {
    schema: schemaPart,
    table: tablePart,
  };
}

/**
 * Looks up a table symbol from the symbol table.
 */
export function lookupTableSymbol (
  symbolTable: Readonly<SymbolTable>,
  schema: string,
  table: string,
): TableSymbol | null {
  const tableSymbolIndex = createTableSymbolIndex(table);

  if (schema === DEFAULT_SCHEMA_NAME) {
    const symbol = symbolTable.get(tableSymbolIndex);
    return symbol instanceof TableSymbol ? symbol : null;
  }

  const schemaSymbolIndex = createSchemaSymbolIndex(schema);
  const schemaSymbol = symbolTable.get(schemaSymbolIndex);

  if (!schemaSymbol || !schemaSymbol.symbolTable) {
    return null;
  }

  const symbol = schemaSymbol.symbolTable.get(tableSymbolIndex);
  return symbol instanceof TableSymbol ? symbol : null;
}

/**
 * Removes surrounding double quotes from a string if present.
 */
export function stripQuotes (str: string): string {
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    return str.slice(1, -1);
  }
  return str;
}
