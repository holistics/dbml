import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { None, Option, Some } from '@/core/option';
import { SymbolIndexKind } from './symbolKind';

// Used to index a symbol table to obtain a symbol
declare const __symbolIndexBrand: unique symbol;

export type NodeSymbolIndex<T extends SymbolIndexKind = SymbolIndexKind> = string & { readonly [__symbolIndexBrand]: T };

export function createSymbolIndex<T extends SymbolIndexKind> (kind: T, key: string): NodeSymbolIndex<T> {
  return `${kind}:${key}` as NodeSymbolIndex<T>;
}

export function destructureIndex<T extends SymbolIndexKind = SymbolIndexKind> (id: NodeSymbolIndex): Option<{ name: string; kind: T }> {
  const [kind, name] = id.split(':');

  return Object.values(SymbolIndexKind).includes(kind as any)
    ? new Some({
        name,
        kind: kind as T,
      })
    : new None();
}

export function isPublicSchemaIndex (id: NodeSymbolIndex): boolean {
  const res = destructureIndex(id).unwrap_or(undefined);
  if (!res) {
    return false;
  }
  const { kind, name } = res;

  return kind === SymbolIndexKind.Schema && name === DEFAULT_SCHEMA_NAME;
}
