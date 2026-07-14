import ModelExporter from './export/ModelExporter';
import Parser from './parse/Parser';
import importer from './import';
import exporter from './export';
import {
  renameTable,
  updateElementSetting,
  syncDiagramView,
  findDiagramViewBlocks,
  syncDep,
  findDepBlocks,
} from './transform';
export {
  renameTable,
  updateElementSetting,
  syncDiagramView,
  findDiagramViewBlocks,
  syncDep,
  findDepBlocks,
  importer,
  exporter,
  ModelExporter,
  Parser,
};
export type { ExportFormat, ExportOptions } from './export/index';
export type { DbmlExporterOptions } from './export/DbmlExporter';
export type { JsonExporterOptions } from './export/JsonExporter';
export type { ImportFormat, ImportOptions } from './import/index';
export { CompilerDiagnostic, CompilerError, CompilerError as CompilerDiagnostics, EditorPosition, ErrorCode, WarningLevel } from './parse/error';
export * from './model_structure';

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
  DEFAULT_ENTRY,
  Filepath,
  SymbolKind,
  MetadataKind,
} from '@dbml/parse';

// Re-export types
export type {
  ElementRef,
  DiagramView,
  FilterConfig,
  DiagramViewSyncOperation,
  DiagramViewBlock,
  DepSyncOperation,
  DepSyncEdge,
  DepEndpointRef,
  DepBlock,
  TextEdit,
  ElementIdentifier,
  SchemaIdentifier,
  TableIdentifier,
  ColumnIdentifier,
  EnumIdentifier,
  EndpointRef,
  RefIdentifier,
  DepIdentifier,
  NoteIdentifier,
  TableGroupIdentifier,
} from '@dbml/parse';
