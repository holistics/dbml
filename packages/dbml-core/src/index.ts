import ModelExporter from './export/ModelExporter';
import Parser from './parse/Parser';
import { CompilerError } from './parse/error';
import importer from './import';
import exporter from './export';
import {
  renameTable,
  syncDiagramView,
  findDiagramViewBlocks,
} from './transform';
import { VERSION } from './utils/version';

export {
  importer,
  exporter,
  renameTable,
  syncDiagramView,
  findDiagramViewBlocks,
  ModelExporter,
  CompilerError,
  Parser,
  VERSION,
};

// Re-export types and utilities from @dbml/parse
export {
  isIntegerType,
  isFloatType,
  isNumericType,
  isBooleanType,
  isStringType,
  isBinaryType,
  isDateTimeType,
  isSerialType,
  tryExtractBoolean,
  tryExtractNumeric,
  tryExtractInteger,
  tryExtractString,
  tryExtractDateTime,
  tryExtractEnum,
  addDoubleQuoteIfNeeded,
  formatRecordValue,
  // Monaco editor syntax highlighting
  dbmlMonarchTokensProvider,
} from '@dbml/parse';

// Re-export types
export type {
  Database,
  MasterDatabase,
  Table,
  Note,
  Column,
  ColumnType,
  Index,
  Check,
  InlineRef,
  Ref,
  RefEndpointPair,
  RefEndpoint,
  RelationCardinality,
  Enum,
  EnumField,
  TableGroup,
  TableGroupField,
  Alias,
  AliasKind,
  TablePartial,
  TablePartialInjection,
  RecordValue,
  RecordValueType,
  TableRecord,
  Project,
  SchemaElement,
  TokenPosition,
  ElementRef,
  DiagramView,
  FilterConfig,
  DiagramViewSyncOperation,
  DiagramViewBlock,
  TextEdit,
} from '@dbml/parse';
