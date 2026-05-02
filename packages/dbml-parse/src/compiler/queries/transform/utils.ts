import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  Filepath,
} from '@/core/types/filepath';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  NodeSymbol, SymbolKind,
} from '@/core/types/symbol';
import type Compiler from '../../index';
import {
  splitQualifiedIdentifier,
} from '../utils';

export type TableNameInput = string | { schema?: string;
  table: string; };

/**
 * Normalizes a table name input to { schema, table } format.
 * Properly handles quoted identifiers with dots inside.
 */
export function normalizeTableName (input: TableNameInput): {
  schema: string;
  table: string;
} {
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
  filepath: Filepath,
  schema: string,
  table: string,
): NodeSymbol | null {
  const ast = compiler.parseFile(filepath).getValue().ast;
  const astSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!astSymbol) return null;

  if (schema === DEFAULT_SCHEMA_NAME) {
    const symbol = compiler.lookupMembers(
      astSymbol,
      SymbolKind.Table,
      table,
    );
    return symbol ?? null;
  }

  const schemaSymbol = compiler.lookupMembers(
    astSymbol,
    SymbolKind.Schema,
    schema,
  );
  if (!schemaSymbol) return null;

  const tableSymbol = compiler.lookupMembers(
    schemaSymbol,
    SymbolKind.Table,
    table,
  );

  return tableSymbol ?? null;
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
