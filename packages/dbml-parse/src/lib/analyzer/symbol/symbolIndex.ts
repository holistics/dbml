import { None, Option, Some } from '@lib/option';

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
  TablePartial = 'TablePartial',
  TablePartialInjection = 'TablePartialInjection',
}

export function createSchemaSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Schema}:${key}`;
}

export function createTableSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Table}:${key}`;
}

export function createColumnSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Column}:${key}`;
}

export function createEnumSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Enum}:${key}`;
}

export function createEnumFieldSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.EnumField}:${key}`;
}

export function createTableGroupSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.TableGroup}:${key}`;
}

export function createTableGroupFieldSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.TableGroupField}:${key}`;
}

export function createStickyNoteSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.Note}:${key}`;
}

export function createTablePartialSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.TablePartial}:${key}`;
}

export function createTablePartialInjectionSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.TablePartialInjection}:${key}`;
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

  return kind === 'Schema' && name === 'public';
}

export function isInjectionIndex (id: NodeSymbolIndex): boolean {
  const res = destructureIndex(id).unwrap_or(undefined);
  if (!res) return false;

  const { kind } = res;
  return kind === SymbolKind.TablePartialInjection;
}

export function getInjectorIndex (injectionNodeIndex: NodeSymbolIndex): NodeSymbolIndex | null {
  const res = destructureIndex(injectionNodeIndex).unwrap_or(undefined);
  if (!res) return null;

  const { kind, name } = res;
  return kind === SymbolKind.TablePartialInjection ? createNodeSymbolIndex(name, SymbolKind.TablePartial) : null;
}
