import ModelExporter from './export/ModelExporter';
import Parser from './parse/Parser';
import { CompilerError } from './parse/error';
import importer from './import';
import exporter from './export';
import {
  renameTable,
  createDiagramView,
  updateDiagramView,
  renameDiagramView,
  deleteDiagramView,
  migrateViewsToDbml,
  syncDiagramViews,
  type DiagramViewFilterConfig,
  type DiagramViewOperation,
  type ViewItem,
} from './transform';
import { VERSION } from './utils/version';

export {
  importer,
  exporter,
  renameTable,
  createDiagramView,
  updateDiagramView,
  renameDiagramView,
  deleteDiagramView,
  migrateViewsToDbml,
  syncDiagramViews,
  ModelExporter,
  CompilerError,
  Parser,
  VERSION,
};

export type {
  DiagramViewFilterConfig,
  DiagramViewOperation,
  ViewItem,
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
} from '@dbml/parse';
