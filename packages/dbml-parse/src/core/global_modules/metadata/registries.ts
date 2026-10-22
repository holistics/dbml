import { CompileErrorCode } from '@/core/types/errors';
import { SettingName } from '@/core/types/keywords';
import type {
  Color, Column, Note, Table, TableGroup,
} from '@/core/types/schemaJson';
import { MetadataTargetKind } from '@/core/types/symbol';
import { extractColor, extractHexColor, extractNote } from '@/core/utils/interpret';
import { isValidColorOrNone, isValidHexColor } from '@/core/utils/validate';
import type { MetadataFieldRegistry } from './utils';

// Builtin metadata fields of every Metadata target kind.
// Kept apart from the element interpreters so both they and the metadata module can import them without a cycle.

export const TABLE_METADATA_FIELDS: MetadataFieldRegistry<Table, { [SettingName.Note]: string; [SettingName.HeaderColor]: Color }> = {
  [SettingName.Note]: {
    type: 'string',
    parse: extractNote,
    isValid: (node) => extractNote(node) !== undefined,
    invalidError: { code: CompileErrorCode.INVALID_TABLE_SETTING_VALUE, message: "'note' must be a string literal" },
    allowDuplicate: false,
    duplicateError: { code: CompileErrorCode.DUPLICATE_TABLE_SETTING, message: "'note' can only appear once" },
    message: "'note' must be a string literal",
    assign (element, value, token) {
      element.note = { value, token };
    },
  },
  [SettingName.HeaderColor]: {
    type: 'color',
    parse: extractHexColor,
    isValid: isValidHexColor,
    invalidError: { code: CompileErrorCode.INVALID_TABLE_SETTING_VALUE, message: "'headercolor' must be a color literal" },
    allowDuplicate: false,
    duplicateError: { code: CompileErrorCode.DUPLICATE_TABLE_SETTING, message: "'headercolor' can only appear once" },
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
    isValid: (node) => extractNote(node) !== undefined,
    invalidError: { code: CompileErrorCode.INVALID_COLUMN_SETTING_VALUE, message: "'note' must be a quoted string" },
    allowDuplicate: false,
    duplicateError: { code: CompileErrorCode.DUPLICATE_COLUMN_SETTING, message: "'note' can only appear once" },
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
    isValid: (node) => extractNote(node) !== undefined,
    invalidError: { code: CompileErrorCode.INVALID_TABLEGROUP_SETTING_VALUE, message: "'note' must be a string literal" },
    allowDuplicate: false,
    duplicateError: { code: CompileErrorCode.DUPLICATE_TABLEGROUP_SETTING, message: "'note' can only appear once" },
    message: "'note' must be a string literal",
    assign (element, value, token) {
      element.note = { value, token };
    },
  },
  [SettingName.Color]: {
    type: 'color',
    parse: extractHexColor,
    isValid: isValidHexColor,
    invalidError: { code: CompileErrorCode.INVALID_TABLEGROUP_SETTING_VALUE, message: "'color' must be a color literal" },
    allowDuplicate: false,
    duplicateError: { code: CompileErrorCode.DUPLICATE_TABLEGROUP_SETTING, message: "'color' can only appear once" },
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
    isValid: isValidColorOrNone,
    invalidError: { code: CompileErrorCode.INVALID_NOTE_SETTING_VALUE, message: "'color' must be a color literal or 'none'" },
    allowDuplicate: false,
    duplicateError: { code: CompileErrorCode.DUPLICATE_NOTE_SETTING, message: "'color' can only appear once" },
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
