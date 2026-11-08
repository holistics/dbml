import { SettingName } from '@/core/types/keywords';
import type {
  ArchSettingValue, Color, Column, ArchGroup, ArchNode, Note, Ref, Table, TableGroup,
} from '@/core/types/schemaJson';
import type { SyntaxNode } from '@/core/types/nodes';
import { extractBooleanLiteral, extractQuotedStringToken, extractVariableFromExpression } from '@/core/utils/expression';
import { MetadataTargetKind } from '@/core/types/symbol';
import { extractColor, extractHexColor, extractNote } from '@/core/utils/interpret';
import type { MetadataField, MetadataFieldRegistry } from './utils';

// Builtin metadata fields of every Metadata target kind.
// Kept apart from the element interpreters so both they and the metadata module can import them without a cycle.

export const TABLE_METADATA_FIELDS: MetadataFieldRegistry<Table, { [SettingName.Note]: string; [SettingName.HeaderColor]: Color }> = {
  [SettingName.Note]: {
    type: 'string',
    parse: extractNote,
    message: "'note' must be a string literal",
    assign (element, value, token) {
      element.note = { value, token };
    },
  },
  [SettingName.HeaderColor]: {
    type: 'color',
    parse: extractHexColor,
    message: "'headercolor' must be a color literal",
    assign (element, value) {
      element.headerColor = value;
    },
  },
};

export const COLUMN_METADATA_FIELDS: MetadataFieldRegistry<Column, { [SettingName.Note]: string }> = {
  [SettingName.Note]: {
    type: 'string',
    parse: extractNote,
    message: "'note' must be a quoted string",
    assign (element, value, token) {
      element.note = { value, token };
    },
  },
};

export const TABLEGROUP_METADATA_FIELDS: MetadataFieldRegistry<TableGroup, { [SettingName.Note]: string; [SettingName.Color]: Color }> = {
  [SettingName.Note]: {
    type: 'string',
    parse: extractNote,
    message: "'note' must be a string literal",
    assign (element, value, token) {
      element.note = { value, token };
    },
  },
  [SettingName.Color]: {
    type: 'color',
    parse: extractHexColor,
    message: "'color' must be a color literal",
    assign (element, value) {
      element.color = value;
    },
  },
};

export const NOTE_METADATA_FIELDS: MetadataFieldRegistry<Note, { [SettingName.Color]: Color }> = {
  [SettingName.Color]: {
    type: 'color',
    parse: extractColor,
    message: "'color' must be a color literal or 'none'",
    assign (element, value) {
      element.color = value;
    },
  },
};

export const REF_METADATA_FIELDS: MetadataFieldRegistry<Ref, { [SettingName.Color]: Color; [SettingName.Note]: string }> = {
  [SettingName.Color]: {
    type: 'color',
    parse: extractHexColor,
    message: "'color' must be a color literal",
    assign (element, value) {
      element.color = value;
    },
  },
  [SettingName.Note]: {
    type: 'string',
    parse: extractNote,
    message: "'note' must be a string literal",
    assign (element, value, token) {
      element.note = { value, token };
    },
  },
};

export const METADATA_FIELDS_BY_KIND: Record<MetadataTargetKind, MetadataFieldRegistry<any, any>> = {
  [MetadataTargetKind.Table]: TABLE_METADATA_FIELDS,
  [MetadataTargetKind.Column]: COLUMN_METADATA_FIELDS,
  [MetadataTargetKind.TableGroup]: TABLEGROUP_METADATA_FIELDS,
  [MetadataTargetKind.Note]: NOTE_METADATA_FIELDS,
  [MetadataTargetKind.Ref]: REF_METADATA_FIELDS,
};

// Architecture nodes and groups keep their settings as written in `settings`. The interpreter resolves `type` and `icon` from there.

const toSettings = (key: string) => (element: Partial<ArchNode | ArchGroup>, value: ArchSettingValue) => {
  element.settings = { ...element.settings, [key]: value };
};

// `style: dashed` or `label: top`, quoted or not
const keyword = (...words: string[]) => (node?: SyntaxNode): string | undefined => {
  const value = (extractVariableFromExpression(node) ?? extractQuotedStringToken(node))?.toLowerCase();
  return value !== undefined && words.includes(value) ? value : undefined;
};

// `[stacked]` alone is true
const flag = (node?: SyntaxNode): boolean | undefined => (node === undefined ? true : extractBooleanLiteral(node) ?? undefined);

const archNote: MetadataField<ArchNode | ArchGroup, string> = {
  type: 'string',
  parse: extractNote,
  message: "'note' must be a string literal",
  assign (element, value, token) {
    element.note = { value, token };
  },
};

const archColor: MetadataField<ArchNode | ArchGroup, Color> = {
  type: 'color',
  parse: extractHexColor,
  message: "'color' must be a color literal",
  assign: toSettings('color'),
};

const archStyle: MetadataField<ArchNode | ArchGroup, string> = {
  type: 'string',
  parse: keyword('dashed'),
  message: "'style' can only be dashed",
  assign: toSettings('style'),
};

export const NODE_METADATA_FIELDS: MetadataFieldRegistry<ArchNode, any> = {
  type: {
    type: 'string',
    parse: extractQuotedStringToken,
    message: "'type' must be a string literal",
    assign: toSettings('type'),
  },
  icon: {
    type: 'string',
    parse: extractQuotedStringToken,
    message: "'icon' must be a string literal",
    assign: toSettings('icon'),
  },
  color: archColor,
  style: archStyle,
  note: archNote,
};

export const GROUP_METADATA_FIELDS: MetadataFieldRegistry<ArchGroup, any> = {
  color: archColor,
  style: archStyle,
  label: {
    type: 'string',
    parse: keyword('top', 'bottom'),
    message: "'label' can only be top or bottom",
    assign: toSettings('label'),
  },
  stacked: {
    type: 'bool',
    parse: flag,
    message: "'stacked' must be true or false",
    assign: toSettings('stacked'),
  },
  note: archNote,
};
