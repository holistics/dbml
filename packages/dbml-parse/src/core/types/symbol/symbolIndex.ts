import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';

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
  StickyNote = 'Note',
  TablePartial = 'TablePartial',
  PartialInjection = 'PartialInjection',
  DiagramView = 'DiagramView',
  DiagramViewField = 'DiagramView field',
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
  return `${SymbolKind.StickyNote}:${key}`;
}

export function createTablePartialSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.TablePartial}:${key}`;
}

export function createPartialInjectionSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.PartialInjection}:${key}`;
}

export function createDiagramViewSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.DiagramView}:${key}`;
}

export function createDiagramViewFieldSymbolIndex (key: string): NodeSymbolIndex {
  return `${SymbolKind.DiagramViewField}:${key}`;
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
    case SymbolKind.StickyNote:
      return createStickyNoteSymbolIndex(key);
    case SymbolKind.TablePartial:
      return createTablePartialSymbolIndex(key);
    case SymbolKind.PartialInjection:
      return createPartialInjectionSymbolIndex(key);
    case SymbolKind.DiagramView:
      return createDiagramViewSymbolIndex(key);
    case SymbolKind.DiagramViewField:
      return createDiagramViewFieldSymbolIndex(key);
    default:
      throw new Error('Unreachable');
  }
}

export function destructureIndex (id: NodeSymbolIndex): { name: string;
  kind: SymbolKind; } | undefined {
  const [kind, name] = id.split(':');

  return Object.values(SymbolKind).includes(kind as SymbolKind)
    ? {
        name,
        kind: kind as SymbolKind,
      }
    : undefined;
}

export function isPublicSchemaIndex (id: NodeSymbolIndex): boolean {
  const res = destructureIndex(id);
  if (!res) {
    return false;
  }
  const {
    kind, name,
  } = res;

  return kind === 'Schema' && name === DEFAULT_SCHEMA_NAME;
}
