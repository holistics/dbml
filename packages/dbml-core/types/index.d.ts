import ModelExporter from './export/ModelExporter';
import Parser from './parse/Parser';
import importer from './import';
import exporter from './export';
import {
  renameTable,
  updateElementSetting,
  updateElementSettingEdit,
  syncDiagramView,
  findDiagramViewBlocks,
  syncDep,
} from './transform';
export {
  renameTable,
  updateElementSetting,
  updateElementSettingEdit,
  syncDiagramView,
  findDiagramViewBlocks,
  syncDep,
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
  dbmlMonarchTokensProvider,
  DEFAULT_ENTRY,
  Filepath,
  SymbolKind,
  MetadataKind,
  CARDINALITY_ONE,
  CARDINALITY_MAYBE,
  CARDINALITY_SOME,
  CARDINALITY_MANY,
  getMultiplicities,
  getRelationshipOp,
  isEndpointOneSide,
  isEndpointManySide,
  isEndpointOptional,
  isEndpointRequired,
  makeRelationshipRequired,
} from '@dbml/parse';

export { inferMultiplicitiesFromColumns } from './transform/relations';

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
  CustomMetadata,
  RelationCardinality,
  RelationshipOp,
} from '@dbml/parse';
