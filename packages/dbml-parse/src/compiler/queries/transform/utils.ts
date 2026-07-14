import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { NodeSymbol, SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { splitQualifiedIdentifier } from '../utils';
import type { EndpointRef } from './types';
export type { ElementIdentifier } from './types';

// Compares two endpoint refs for equality (schema-aware, field-aware)
export function endpointsEqual (a: EndpointRef, b: EndpointRef): boolean {
  const sa = (a.schemaName && a.schemaName.length > 0) ? a.schemaName : DEFAULT_SCHEMA_NAME;
  const sb = (b.schemaName && b.schemaName.length > 0) ? b.schemaName : DEFAULT_SCHEMA_NAME;
  if (sa !== sb) return false;
  if (a.tableName !== b.tableName) return false;
  const fa = a.fieldNames ?? [];
  const fb = b.fieldNames ?? [];
  if (fa.length !== fb.length) return false;
  return fa.every((f, i) => f === fb[i]);
}

export function normalizeTableName (input: string | { schema?: string; table: string }): {
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
 * Looks up an element symbol by its qualified name and kind.
 */
export function lookupElementSymbol (
  compiler: Compiler,
  filepath: Filepath,
  schema: string,
  name: string,
  kind: SymbolKind = SymbolKind.Table,
): NodeSymbol | undefined {
  const ast = compiler.parseFile(filepath).getValue().ast;
  const astSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!astSymbol) return undefined;

  if (schema === DEFAULT_SCHEMA_NAME) {
    return compiler.lookupMembers(astSymbol, kind, name) ?? undefined;
  }

  const schemaSymbol = compiler.lookupMembers(astSymbol, SymbolKind.Schema, schema);
  if (!schemaSymbol) return undefined;

  return compiler.lookupMembers(schemaSymbol, kind, name) ?? undefined;
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
