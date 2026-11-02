import { SettingName } from '@/core/types/keywords';
import type {
  ArchSettingValue, Color, Column, Group, Node, Note, Table, TableGroup,
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

export const METADATA_FIELDS_BY_KIND: Record<MetadataTargetKind, MetadataFieldRegistry<any, any>> = {
  [MetadataTargetKind.Table]: TABLE_METADATA_FIELDS,
  [MetadataTargetKind.Column]: COLUMN_METADATA_FIELDS,
  [MetadataTargetKind.TableGroup]: TABLEGROUP_METADATA_FIELDS,
  [MetadataTargetKind.Note]: NOTE_METADATA_FIELDS,
};

// Architecture nodes and groups keep their settings as written in `settings`. The interpreter resolves `type` and `icon` from there.

const toSettings = (key: string) => (element: Partial<Node | Group>, value: ArchSettingValue) => {
  element.settings = { ...element.settings, [key]: value };
};

// `style: dashed` or `label: bottom`, quoted or not
const keyword = (word: string) => (node?: SyntaxNode): string | undefined => {
  const value = extractVariableFromExpression(node) ?? extractQuotedStringToken(node);
  return value?.toLowerCase() === word ? word : undefined;
};

// `[inactive]` alone is true
const flag = (node?: SyntaxNode): boolean | undefined => (node === undefined ? true : extractBooleanLiteral(node) ?? undefined);

const archNote: MetadataField<Node | Group, string> = {
  type: 'string',
  parse: extractNote,
  message: "'note' must be a string literal",
  assign (element, value, token) {
    element.note = { value, token };
  },
};

const archColor: MetadataField<Node | Group, Color> = {
  type: 'color',
  parse: extractHexColor,
  message: "'color' must be a color literal",
  assign: toSettings('color'),
};

const archStyle: MetadataField<Node | Group, string> = {
  type: 'string',
  parse: keyword('dashed'),
  message: "'style' can only be dashed",
  assign: toSettings('style'),
};

const archInactive: MetadataField<Node | Group, boolean> = {
  type: 'bool',
  parse: flag,
  message: "'inactive' must be true or false",
  assign: toSettings('inactive'),
};

export const NODE_METADATA_FIELDS: MetadataFieldRegistry<Node, any> = {
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
  inactive: archInactive,
  note: archNote,
};

export const GROUP_METADATA_FIELDS: MetadataFieldRegistry<Group, any> = {
  color: archColor,
  style: archStyle,
  inactive: archInactive,
  label: {
    type: 'string',
    parse: keyword('bottom'),
    message: "'label' can only be bottom",
    assign: toSettings('label'),
  },
  note: archNote,
};
