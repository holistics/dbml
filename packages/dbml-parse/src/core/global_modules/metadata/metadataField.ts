import { SyntaxNode } from '@/core/types/nodes';
import type {
  Column, Note, Table, TableGroup, TokenPosition,
} from '@/core/types/schemaJson';
import { SettingName } from '@/core/types';

export type MetadataTarget = Table | TableGroup | Note | Column;

/**
  * Specs for builtin metadata (table's note, tablegroup's color, .etc) for different element types. Does 2 things:
  * - `validate`: Validating if the metadata value is syntactically correct
  * - `assign`: Write the metadata value to the element builtin props (e.g. write `table.note` instead of `table.metadata`)
  */
export interface MetadataField<T extends MetadataTarget> {
  /** Check if the metadata value is syntactically correct */
  isValidBuiltinFieldValue (node?: SyntaxNode): boolean;
  message: string;

  /** Write the metadata value to the element builtin props (e.g. write to `table.note`) */
  assignBuiltinField (element: Partial<T>, value: string, token: TokenPosition): void;
}

// A per-kind registry: exactly the promotable settings for that kind, each
// carrying its own validate + assign. K is tightened per kind.
export type MetadataFieldRegistry<T extends MetadataTarget, K extends SettingName = SettingName> = Record<K, MetadataField<T>>;
