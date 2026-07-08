import { SyntaxNode } from '@/core/types/nodes';
import type {
  Column, Note, Table, TableGroup, TokenPosition,
} from '@/core/types/schemaJson';
import { SettingName } from '@/core/types';

export type MetadataTarget = Table | TableGroup | Note | Column;

// A single builtin metadata field, bundling validation (used by both the inline
// setting-list path and the metadata-block path) and the dumb-writer assign
// (used only in the interpret pass to promote block-form values onto typed
// fields). Both fields are required so that validate/assign key parity is
// structural — impossible to violate.
export interface MetadataField<T extends MetadataTarget> {
  validate (node?: SyntaxNode): boolean;
  message: string;
  assign (element: T, value: string, token: TokenPosition): void;
}

// A per-kind registry: exactly the promotable settings for that kind, each
// carrying its own validate + assign. K is tightened per kind.
export type MetadataFieldRegistry<T extends MetadataTarget, K extends SettingName = SettingName> =
  Record<K, MetadataField<T>>;
