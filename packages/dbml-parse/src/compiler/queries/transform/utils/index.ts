import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { NodeSymbol, SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../../index';
import { addDoubleQuoteIfNeeded, splitQualifiedIdentifier } from '../../utils';
import type { EndpointRef } from '../types';
export type { ElementIdentifier } from '../types';
export { findRefDefinition, type InlineRef, type StandaloneRef } from './ref';

export function normalizeSchema (schema?: string | null): string {
  return schema && schema.length > 0 ? schema : DEFAULT_SCHEMA_NAME;
}

export function endpointsEqual (left: EndpointRef, right: EndpointRef): boolean {
  if (normalizeSchema(left.schemaName) !== normalizeSchema(right.schemaName))
    return false;
  if (left.tableName !== right.tableName) return false;
  const leftFieldNames = left.fieldNames ?? [];
  const rightFieldNames = right.fieldNames ?? [];
  if (leftFieldNames.length !== rightFieldNames.length) return false;
  return leftFieldNames.every((leftField, i) => leftField === rightFieldNames[i]);
}

export function endpointMatches (
  candidate: EndpointRef,
  target: EndpointRef,
): boolean {
  if (normalizeSchema(candidate.schemaName) !== normalizeSchema(target.schemaName)) return false;
  if (candidate.tableName !== target.tableName) return false;
  const targetFieldNames = target.fieldNames ?? [];
  if (targetFieldNames.length === 0) return true;
  const candidateFieldNames = candidate.fieldNames ?? [];
  if (candidateFieldNames.length !== targetFieldNames.length) return false;
  return candidateFieldNames.every((f, i) => f === targetFieldNames[i]);
}

export function normalizeTableName (
  input: string | { schema?: string; table: string },
): {
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

  const schemaSymbol = compiler.lookupMembers(
    astSymbol,
    SymbolKind.Schema,
    schema,
  );
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

// Serialize endpoint to a nice string
export function formatEndpoint (ep: EndpointRef): string {
  const parts: string[] = [];
  if (ep.schemaName && ep.schemaName !== DEFAULT_SCHEMA_NAME)
    parts.push(addDoubleQuoteIfNeeded(ep.schemaName));
  parts.push(addDoubleQuoteIfNeeded(ep.tableName));
  for (const f of ep.fieldNames ?? []) parts.push(addDoubleQuoteIfNeeded(f));
  return parts.join('.');
}

// Serialize setting to a nice string
export function formatSetting (
  name: string,
  value: string | null | undefined,
): string {
  if (value === undefined) return name;
  if (value === null) return '';
  return `${name}: ${value}`;
}
