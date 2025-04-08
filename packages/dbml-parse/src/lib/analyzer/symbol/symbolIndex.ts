import { None, Option, Some } from '../../option';

// Used to index a symbol table to obtain a symbol
export type NodeSymbolIndex = string;

export enum SymbolKind {
  Schema = 'Schema',
  Table = 'Table',
  Column = 'Column',
  TableGroup = 'TableGroup',
  TableGroupField = 'TableGroup field',
  Enum = 'Enum',
  EnumField = 'Enum field',
  Note = 'Note',
  TableFragment = 'TableFragment',
}

export function createNodeSymbolIndex (key: string, symbolKind: SymbolKind): NodeSymbolIndex {
  switch (symbolKind) {
    case SymbolKind.Column:
    case SymbolKind.Enum:
    case SymbolKind.EnumField:
    case SymbolKind.Schema:
    case SymbolKind.Table:
    case SymbolKind.TableGroup:
    case SymbolKind.TableGroupField:
    case SymbolKind.TableFragment:
      return `${symbolKind}:${key}`;
    default:
      throw new Error('Unreachable');
  }
}

export const createSchemaSymbolIndex = (key: string): NodeSymbolIndex => createNodeSymbolIndex(key, SymbolKind.Schema);

export const createTableSymbolIndex = (key: string): NodeSymbolIndex => createNodeSymbolIndex(key, SymbolKind.Table);

export const createColumnSymbolIndex = (key: string): NodeSymbolIndex => createNodeSymbolIndex(key, SymbolKind.Column);

export const createEnumSymbolIndex = (key: string): NodeSymbolIndex => createNodeSymbolIndex(key, SymbolKind.Enum);

export const createEnumFieldSymbolIndex = (key: string): NodeSymbolIndex => createNodeSymbolIndex(key, SymbolKind.EnumField);

export const createTableGroupSymbolIndex = (key: string): NodeSymbolIndex => createNodeSymbolIndex(key, SymbolKind.TableGroup);

export const createTableGroupFieldSymbolIndex = (key: string): NodeSymbolIndex => createNodeSymbolIndex(key, SymbolKind.TableGroupField);

export const createTableFragmentSymbolIndex = (key: string): NodeSymbolIndex => createNodeSymbolIndex(key, SymbolKind.TableFragment);

export function createStickyNoteSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Note}:${key}`;
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

  return kind === SymbolKind.Schema && name === 'public';
}
