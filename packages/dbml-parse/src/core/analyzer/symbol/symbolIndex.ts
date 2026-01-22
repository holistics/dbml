import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { None, Option, Some } from '@/core/option';

// Used to index a symbol table to obtain a symbol
declare const __symbolIndexBrand: unique symbol;

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
}

export type SchemaSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.Schema };
export type TableSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.Table };
export type ColumnSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.Column };
export type EnumSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.Enum };
export type EnumFieldSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.EnumField };
export type TableGroupSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.TableGroup };
export type TableGroupFieldSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.TableGroupField };
export type StickyNoteSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.StickyNote };
export type TablePartialSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.TablePartial };
export type PartialInjectionSymbolIndex = string & { readonly [__symbolIndexBrand]: SymbolKind.PartialInjection };

export type NodeSymbolIndex =
  | SchemaSymbolIndex
  | TableSymbolIndex
  | ColumnSymbolIndex
  | EnumSymbolIndex
  | EnumFieldSymbolIndex
  | TableGroupSymbolIndex
  | TableGroupFieldSymbolIndex
  | StickyNoteSymbolIndex
  | TablePartialSymbolIndex
  | PartialInjectionSymbolIndex;

export function createSchemaSymbolIndex (key: string): SchemaSymbolIndex {
  return `${SymbolKind.Schema}:${key}` as SchemaSymbolIndex;
}

export function createTableSymbolIndex (key: string): TableSymbolIndex {
  return `${SymbolKind.Table}:${key}` as TableSymbolIndex;
}

export function createColumnSymbolIndex (key: string): ColumnSymbolIndex {
  return `${SymbolKind.Column}:${key}` as ColumnSymbolIndex;
}

export function createEnumSymbolIndex (key: string): EnumSymbolIndex {
  return `${SymbolKind.Enum}:${key}` as EnumSymbolIndex;
}

export function createEnumFieldSymbolIndex (key: string): EnumFieldSymbolIndex {
  return `${SymbolKind.EnumField}:${key}` as EnumFieldSymbolIndex;
}

export function createTableGroupSymbolIndex (key: string): TableGroupSymbolIndex {
  return `${SymbolKind.TableGroup}:${key}` as TableGroupSymbolIndex;
}

export function createTableGroupFieldSymbolIndex (key: string): TableGroupFieldSymbolIndex {
  return `${SymbolKind.TableGroupField}:${key}` as TableGroupFieldSymbolIndex;
}

export function createStickyNoteSymbolIndex (key: string): StickyNoteSymbolIndex {
  return `${SymbolKind.StickyNote}:${key}` as StickyNoteSymbolIndex;
}

export function createTablePartialSymbolIndex (key: string): TablePartialSymbolIndex {
  return `${SymbolKind.TablePartial}:${key}` as TablePartialSymbolIndex;
}

export function createPartialInjectionSymbolIndex (key: string): PartialInjectionSymbolIndex {
  return `${SymbolKind.PartialInjection}:${key}` as PartialInjectionSymbolIndex;
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
    case SymbolKind.StickyNote:
      return createStickyNoteSymbolIndex(key);
    default: {
      const _: never = symbolKind;
      throw new Error(`Unexpected SymbolKind: ${symbolKind}`);
    }
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

  return kind === SymbolKind.Schema && name === DEFAULT_SCHEMA_NAME;
}
