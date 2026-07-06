import { MetadataTargetKind } from '@/core/types/symbol';
import { SyntaxNode } from '@/core/types/nodes';
import type {
  Color, Column, Note, Table, TableGroup, TokenPosition,
} from '@/core/types/schemaJson';
import { isExpressionAQuotedString, isValidColorOrNone } from '@/core/utils/validate';
import { extractQuotedStringToken } from '@/core/utils/expression';
import { SettingName } from '@/core/types';

function isBooleanStringLiteral (node?: SyntaxNode): boolean {
  if (!isExpressionAQuotedString(node)) return false;
  const value = extractQuotedStringToken(node)?.toLowerCase();
  return value === 'true' || value === 'false';
}

// The emitted schema elements a builtin key may write onto — the type-level
// sibling of MetadataTargetKind. Each field's `assign` narrows this union
// internally to the element it writes; the matrix (BUILTIN_METADATA_KEYS)
// guarantees the field is only ever paired with a target that has it, which makes
// those narrowings sound.
export type MetadataTarget = Table | TableGroup | Note | Column;

// The two phase-specific behaviours of a builtin field, co-located so a field's
// validation and its assignment cannot drift out of sync:
//   - `validate` runs in the validation pass against the inline value AST node
//     (`sub.body?.callee`, which may be undefined) and reports whether it is an
//     admissible value for this field. The caller owns CompileError construction;
//     `message` is the value-type fragment it splices into the diagnostic.
//   - `assign` runs in the interpret pass against the already-extracted scalar
//     plus its token, writing it onto the typed inline field. It is only sound
//     after `validate` has passed for the same value (the validate-before-assign
//     precondition the casts below rely on).
interface BuiltinMetadataSpec {
  validate (valueNode?: SyntaxNode): boolean;
  assign (element: MetadataTarget, value: string, token: TokenPosition): void;
  message: string;
}

// Per-setting behaviour table, keyed by SettingName. A partial record: only the
// settings a metadata block may promote onto a typed field appear here. This
// table MUST stay a superset of every key used in BUILTIN_METADATA_KEYS — the
// validate/write passes guard the lookup, so a matrixed key without a spec is
// silently treated as plain custom metadata rather than crashing.
export const BUILTIN_METADATA_FIELD_HELPERS: Partial<Record<SettingName, BuiltinMetadataSpec>> = {
  [SettingName.Note]: {
    validate: (node) => isExpressionAQuotedString(node),
    // Validation guarantees a quoted string reached here; `value` is the
    // normalized note text.
    assign: (element: Table | TableGroup | Column, value: string, token) => {
      element.note = { value, token };
    },
    message: 'a string',
  },
  [SettingName.Color]: {
    validate: (node) => isValidColorOrNone(node),
    // Validation guarantees a valid Color literal reached here.
    assign: (element: TableGroup | Note, value: Color) => {
      element.color = value;
    },
    message: "a color literal or 'none'",
  },
  [SettingName.HeaderColor]: {
    validate: (node) => isValidColorOrNone(node),
    // Validation guarantees a valid Color literal reached here.
    assign: (element: Table, value: Color) => {
      element.headerColor = value;
    },
    message: "a color literal or 'none'",
  },
  // Boolean flag settings. In a metadata block the value is the string literal
  // `'true'`/`'false'` (validated by isBooleanStringLiteral); assign parses it
  // to the boolean written onto the typed Column field. Only single-word setting
  // names are supported here — the metadata-field grammar parses `key: value`
  // with a single-identifier key, so multi-word names (`not null`, `primary
  // key`) cannot appear as keys and are intentionally excluded.
  [SettingName.Unique]: {
    validate: (node) => isBooleanStringLiteral(node),
    assign: (element: Column, value: string) => {
      element.unique = value === 'true';
    },
    message: "'true' or 'false'",
  },
  [SettingName.PK]: {
    validate: (node) => isBooleanStringLiteral(node),
    assign: (element: Column, value: string) => {
      element.pk = value === 'true';
    },
    message: "'true' or 'false'",
  },
  [SettingName.Increment]: {
    validate: (node) => isBooleanStringLiteral(node),
    assign: (element: Column, value: string) => {
      element.increment = value === 'true';
    },
    message: "'true' or 'false'",
  },
};

// Per-target-kind builtin-key matrix. A metadata key listed here for a target
// kind is (a) validated as the corresponding inline value type and (b) written
// onto the typed inline field, overriding any inline-declared value. Keys not
// listed for a target kind are plain custom metadata: not validated, not written.
//
// This is the single source of truth shared by validation
// (local_modules/metadata/validate.ts) and writing
// (global_modules/program/interpret.ts).
export const BUILTIN_METADATA_KEYS: Partial<Record<MetadataTargetKind, SettingName[]>> = {
  [MetadataTargetKind.Table]: [
    SettingName.Note,
    SettingName.HeaderColor,
  ],
  [MetadataTargetKind.TableGroup]: [
    SettingName.Note,
    SettingName.Color,
  ],
  [MetadataTargetKind.Note]: [
    SettingName.Color,
  ],
  [MetadataTargetKind.Column]: [
    SettingName.Note,
    SettingName.Unique,
    SettingName.PK,
    SettingName.Increment,
  ],
};

// NOTE: this matrix (which metadata-block keys get promoted onto typed fields)
// is distinct from the *_BUILTIN_SETTINGS allow-lists in metadata/interpret.ts,
// which mark which inline `[...]` keys are typed settings (hence excluded from
// harvested custom metadata). Related but separate concerns — keep both in sync
// by hand when adding a setting.

// Look up a builtin key (case-insensitive) for a target kind. Returns undefined
// when the key is plain custom metadata for that target kind.
export function findBuiltinSettingName (targetKind: MetadataTargetKind | undefined, key: string): SettingName | undefined {
  if (!targetKind) return undefined;

  const entries = BUILTIN_METADATA_KEYS[targetKind];
  if (!entries) return undefined;
  const lowered = key.toLowerCase();
  return entries.find((e) => e === lowered);
}
