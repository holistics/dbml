import ModelExporter from './export/ModelExporter';
import Parser from './parse/Parser';
import { CompilerError } from './parse/error';
import importer from './import';
import exporter from './export';
import {
  renameTable,
  syncDiagramView,
} from './transform';
import { VERSION } from './utils/version';

export {
  importer,
  exporter,
  renameTable,
  syncDiagramView,
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
  DiagramViewSyncOperation,
  DiagramView,
  FilterConfig,
  TextEdit,
} from '@dbml/parse';
