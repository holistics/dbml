import { SyntaxNode } from '@/core/types/nodes';
import type {
  Column, Note, Table, TableGroup, TokenPosition,
} from '@/core/types/schemaJson';
import { SettingName } from '@/core/types';

export type MetadataTarget = Table | TableGroup | Note | Column;

// Validation specs of a builtin metadata field, owned by the target element's local module.
// `message` is complete diagnostic
export interface FieldValidateSpec {
  predicate (valueNode?: SyntaxNode): boolean;
  message: string;
}

// A per-setting validation table for one target kind, owned by that element's local validate module.
export type FieldValidateMap<T extends SettingName = SettingName> = Record<T, FieldValidateSpec>;

// Assignment half of a builtin metadata field, owned by the target element's
// global interpret module. Runs in the interpret pass against the
// already-extracted scalar plus its token, writing it onto the typed field. Only
// sound after the matching FieldValidateSpec has passed for the same value.
export type FieldAssign<T extends MetadataTarget> = (element: T, value: string, token: TokenPosition) => void;

// A per-setting assignment table for one target kind, owned by that element's
// global interpret module. Its key set MUST equal the validate map's key set for
// the same kind (asserted by a test) — that equality replaces the old
// co-location of validate+assign.
export type FieldAssignMap<T extends MetadataTarget = MetadataTarget, P extends SettingName = SettingName> = Record<P, FieldAssign<T>>;
