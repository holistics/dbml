import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import { splitQualifiedIdentifier } from '../utils';
import type Compiler from '../../index';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';

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
 * Looks up a table symbol by matching its full qualified name.
 */
export function lookupTableSymbol (
  compiler: Compiler,
  schema: string,
  table: string,
): NodeSymbol | null {
  const publicSymbols = compiler._parse.publicSymbolTable();
  if (!publicSymbols) return null;

  // Build the expected fullname
  const expectedFullname = schema === DEFAULT_SCHEMA_NAME ? [table] : [schema, table];

  // First try by table name
  const byName = publicSymbols.find((sym) => {
    if (!sym.isKind(SymbolKind.Table)) return false;
    if (!sym.declaration) return false;
    const fn = compiler.fullname(sym.declaration);
    if (fn.hasValue(UNHANDLED)) return false;
    const parts = fn.getValue();
    if (!parts) return false;
    const lastName = parts.at(-1);
    const schemaPrefix = parts.length >= 2 ? parts[0] : DEFAULT_SCHEMA_NAME;
    return lastName === table && schemaPrefix === schema;
  });
  if (byName) return byName;

  // Fall back to alias lookup (aliases are schema-independent)
  if (schema === DEFAULT_SCHEMA_NAME) {
    const byAlias = publicSymbols.find((sym) => {
      if (!sym.isKind(SymbolKind.Table)) return false;
      if (!sym.declaration) return false;
      const aliasResult = compiler.alias(sym.declaration);
      if (aliasResult.hasValue(UNHANDLED)) return false;
      return aliasResult.getValue() === table;
    });
    if (byAlias) return byAlias;
  }

  return null;
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
