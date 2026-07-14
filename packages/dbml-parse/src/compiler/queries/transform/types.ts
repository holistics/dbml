import { SymbolKind } from '@/core/types/symbol';
import { MetadataKind } from '@/core/types/symbol/metadata';

// Identifies any DBML element. `kind` is required to discriminate variants.
// Individual interfaces allow `kind` to be optional for standalone use (e.g. renameTable).
export type ElementIdentifier = (
  SchemaIdentifier
  | TableIdentifier
  | ColumnIdentifier
  | EnumIdentifier
  | RefIdentifier
  | DepIdentifier
  | NoteIdentifier
  | TableGroupIdentifier
) & { kind: string };

export interface SchemaIdentifier {
  kind?: typeof SymbolKind.Schema;
  schema: string;
}

export interface TableIdentifier {
  kind?: typeof SymbolKind.Table;
  schema?: string;
  table: string;
}

export interface ColumnIdentifier {
  kind?: typeof SymbolKind.Column;
  schema?: string;
  table: string;
  column: string;
}

export interface EnumIdentifier {
  kind?: typeof SymbolKind.Enum;
  schema?: string;
  name: string;
}

// A table endpoint, optionally narrowed to specific fields.
// Shared by RefIdentifier and DepIdentifier.
export interface EndpointRef {
  schema?: string;
  table: string;
  fields?: string[];
}

export interface RefIdentifier {
  kind?: typeof MetadataKind.Ref;
  endpoints: [EndpointRef, EndpointRef];
}

export interface DepIdentifier {
  kind?: typeof MetadataKind.Dep;
  upstream: EndpointRef;
  downstream: EndpointRef;
}

export interface NoteIdentifier {
  kind?: typeof SymbolKind.StickyNote;
  name: string;
}

export interface TableGroupIdentifier {
  kind?: typeof SymbolKind.TableGroup;
  schema?: string;
  name: string;
}
