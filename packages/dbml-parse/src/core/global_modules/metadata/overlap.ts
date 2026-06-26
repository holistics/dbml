import { MetadataTargetKind } from '@/core/types/symbol';

// How a promoted overlap value must be reshaped onto the typed inline field.
export enum OverlapValueKind {
  Note = 'note',
  Color = 'color',
  HeaderColor = 'headercolor',
}

// The inline field on the emitted element that an overlap key promotes onto.
export type OverlapInlineField = 'note' | 'color' | 'headerColor';

export interface OverlapKey {
  // The metadata key as it appears (lowercased) in the block. Matching against
  // user input is case-insensitive.
  metaKey: string;
  // The emitted element's typed inline field this key promotes onto.
  field: OverlapInlineField;
  // How the scalar value is reshaped before assignment.
  reshape: OverlapValueKind;
}

// Per-target-kind overlap matrix. A metadata key listed here for a target kind
// is (a) validated as the corresponding inline value type and (b) promoted onto
// the typed inline field, overriding any inline-declared value. Keys not listed
// for a target kind are plain custom metadata: not validated, not promoted.
//
// This is the single source of truth shared by validation
// (local_modules/metadata/validate.ts) and promotion
// (global_modules/program/interpret.ts).
export const OVERLAP_KEYS: Partial<Record<MetadataTargetKind, OverlapKey[]>> = {
  [MetadataTargetKind.Table]: [
    { metaKey: 'note', field: 'note', reshape: OverlapValueKind.Note },
    { metaKey: 'headercolor', field: 'headerColor', reshape: OverlapValueKind.HeaderColor },
  ],
  [MetadataTargetKind.TableGroup]: [
    { metaKey: 'note', field: 'note', reshape: OverlapValueKind.Note },
    { metaKey: 'color', field: 'color', reshape: OverlapValueKind.Color },
  ],
  [MetadataTargetKind.Note]: [
    { metaKey: 'color', field: 'color', reshape: OverlapValueKind.Color },
  ],
  [MetadataTargetKind.Column]: [
    { metaKey: 'note', field: 'note', reshape: OverlapValueKind.Note },
  ],
};

// Look up an overlap key (case-insensitive) for a target kind. Returns undefined
// when the key is plain custom metadata for that target kind.
export function findOverlapKey (
  kind: MetadataTargetKind | undefined,
  key: string,
): OverlapKey | undefined {
  if (kind === undefined) return undefined;
  const entries = OVERLAP_KEYS[kind];
  if (!entries) return undefined;
  const lowered = key.toLowerCase();
  return entries.find((e) => e.metaKey === lowered);
}
