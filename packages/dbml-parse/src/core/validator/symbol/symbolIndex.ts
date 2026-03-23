import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { None, Option, Some } from '@/core/option';

// Used to index a symbol table to obtain a symbol
declare const __nodeSymbolIndexBrand: unique symbol;
export type NodeSymbolIndex = string & { [__nodeSymbolIndexBrand]: true };
export enum SymbolKind {
  Schema = 'Schema',
  Table = 'Table',
  Column = 'Column',
  TableGroup = 'TableGroup',
  TableGroupField = 'TableGroup field',
  Enum = 'Enum',
  EnumField = 'Enum field',
  Note = 'Note',
  TablePartial = 'TablePartial',
  PartialInjection = 'PartialInjection',
}

export function createSchemaSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Schema}:${key}` as NodeSymbolIndex;
}

export function createTableSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Table}:${key}` as NodeSymbolIndex;
}

export function createColumnSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Column}:${key}` as NodeSymbolIndex;
}

export function createEnumSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Enum}:${key}` as NodeSymbolIndex;
}

export function createEnumFieldSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.EnumField}:${key}` as NodeSymbolIndex;
}

export function createTableGroupSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.TableGroup}:${key}` as NodeSymbolIndex;
}

export function createTableGroupFieldSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.TableGroupField}:${key}` as NodeSymbolIndex;
}

export function createStickyNoteSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Note}:${key}` as NodeSymbolIndex;
}

export function createTablePartialSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.TablePartial}:${key}` as NodeSymbolIndex;
}

export function createPartialInjectionSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.PartialInjection}:${key}` as NodeSymbolIndex;
}

export function createNodeSymbolIndex (key: string, symbolKind: SymbolKind): NodeSymbolIndex {
  switch (symbolKind) {
    case SymbolKind.Column:
      return createColumnSymbolIndex(key);
    case SymbolKind.Enum:
      return createEnumSymbolIndex(key);
    case SymbolKind.EnumField:
      return createEnumFieldSymbolIndex(key);
    case SymbolKind.Schema:
      return createSchemaSymbolIndex(key);
    case SymbolKind.Table:
      return createTableSymbolIndex(key);
    case SymbolKind.TableGroup:
      return createTableGroupSymbolIndex(key);
    case SymbolKind.TableGroupField:
      return createTableGroupFieldSymbolIndex(key);
    case SymbolKind.TablePartial:
      return createTablePartialSymbolIndex(key);
    case SymbolKind.PartialInjection:
      return createPartialInjectionSymbolIndex(key);
    case SymbolKind.Note:
      return createStickyNoteSymbolIndex(key);
    default:
      throw new Error('Unreachable');
  }
}

export function destructureIndex (id: NodeSymbolIndex): Option<{ name: string; kind: SymbolKind }> {
  const [kind, name] = id.split(':');

  return Object.values(SymbolKind).includes(kind as SymbolKind)
    ? new Some({
        name,
        kind: kind as SymbolKind,
      })
    : new None();
}

export function isPublicSchemaIndex (id: NodeSymbolIndex): boolean {
  const res = destructureIndex(id).unwrap_or(undefined);
  if (!res) {
    return false;
  }
  const { kind, name } = res;

  return kind === 'Schema' && name === DEFAULT_SCHEMA_NAME;
}
