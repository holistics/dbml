import ModelExporter from './export/ModelExporter';
import Parser from './parse/Parser';
import { CompilerDiagnostics } from './parse/error';
import importer from './import';
import exporter from './export';
import {
  renameTable,
  renameElement,
  updateElementSetting,
  updateElementSettingEdit,
  syncDiagramView,
  findDiagramViewBlocks,
  syncDep,
} from './transform';
import { VERSION } from './utils/version';

export {
  importer,
  exporter,
  renameTable,
  renameElement,
  updateElementSetting,
  updateElementSettingEdit,
  syncDiagramView,
  findDiagramViewBlocks,
  syncDep,
  ModelExporter,
  CompilerDiagnostics,
  Parser,
  VERSION,
};

// Re-export types and utilities from @dbml/parse
export {
  CompileError,
  CompileWarning,
  CompileInfo,
  CompileErrorCode,
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
  DEFAULT_ENTRY,
  Filepath,
  SymbolKind,
  MetadataKind,
  // Relationship cardinality constants and utilities
  CARDINALITY_ONE,
  CARDINALITY_MAYBE,
  CARDINALITY_SOME,
  CARDINALITY_MANY,
  getMultiplicities,
  getRelationshipOp,
  isEndpointOneSide,
  isEndpointManySide,
  isEndpointRequired,
  isEndpointOptional,
  makeRelationshipRequired,
  BUILTIN_ROLES,
  NAME_PRECEDENCE,
  fullName,
} from '@dbml/parse';

export { inferMultiplicitiesFromColumns } from './transform/relations';

// Re-export types
export type {
  Diagnostic,
  DiagnosticQuickFix,
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
  ArchElementIdentifier,
  ArchLinkIdentifier,
  RelationCardinality,
  RelationshipOp,
  DbmlProjectLayout,
  RoleSpec,
  FileSpecifierInfo,
} from '@dbml/parse';
