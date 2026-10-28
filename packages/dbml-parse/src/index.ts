import Compiler from '@/compiler/index';

// Export the types that playground and other consumers need
export { DEFAULT_ENTRY } from '@/constants';

export { Filepath } from '@/core/types/filepath';

export {
  UNHANDLED,
  type Unhandled,
} from '@/core/types/module';

export { ElementKind } from '@/core/types/keywords';

export {
  type NodeSymbol,
  SymbolKind,
} from '@/core/types/symbol';

export { MetadataKind } from '@/core/types/symbol/metadata';

export * from '@/core/global_modules/records/utils';

export * from '@/core/types/nodes';

export {
  // Token types
  SyntaxToken,
  SyntaxTokenKind,
  isTriviaToken,
  isOp,
  isOpToken,
} from '@/core/types/tokens';

export {
  // Error types
  CompileError,
  CompileErrorCode,
} from '@/core/types/errors';

export type {
  // Position interface
  Position,
} from '@/core/types';

export {
  // Scope kinds from compiler
  ScopeKind,
  // Utilities
  splitQualifiedIdentifier,
  unescapeString,
  escapeString,
  formatRecordValue,
  isValidIdentifier,
  addDoubleQuoteIfNeeded,
  normalizeQualifiedName,
} from '@/compiler/index';

// Export interpreted types for structured data
export {
  type Database,
  type MasterDatabase,
  type Table,
  type Note,
  type Column,
  type ColumnType,
  type Index,
  type Check,
  type InlineRef,
  type Ref,
  type RefEndpointPair,
  type RefEndpoint,
  type Enum,
  type EnumField,
  type TableGroup,
  type TableGroupField,
  type Alias,
  type AliasKind,
  type TablePartial,
  type TablePartialInjection,
  type RecordValue,
  type RecordValueType,
  type TableRecord,
  type Project,
  type SchemaElement,
  type TokenPosition,
  type ElementRef,
  type FilterConfig,
  type DiagramView,
  type CustomMetadata,
  type Node,
  type Group,
  type Link,
  type LinkOp,
  type ArchRef,
  type ArchSettings,
  type ArchSettingValue,
} from '@/core/types/schemaJson';

// Architecture files
export { type FileKind, ARCH_DIAGRAM_TYPES, isArchDiagramType } from '@/compiler/queries/files/fileKind';
export {
  BUILTIN_ROLES, NAME_PRECEDENCE, suggestRole, suggestIcon, type RoleSpec,
} from '@/core/arch/vocabulary';
export {
  ICON_ALIAS, ICON_NAMES, isIconName, resolveIcon,
} from '@/core/arch/icons';

export {
  type RelationCardinality,
  type RelationshipOp,
  getRelationshipOp,
  getMultiplicities,
  parseCardinality,
  makeCardinalityRequired,
  makeCardinalityOptional,
  makeRelationshipRequired,
  isEndpointOneSide,
  isEndpointManySide,
  isEndpointOptional,
  isEndpointRequired,
  CARDINALITY_ONE,
  CARDINALITY_MAYBE,
  CARDINALITY_SOME,
  CARDINALITY_MANY,
} from '@/core/types/relation';

// DiagramView types
export type {
  DiagramViewSyncOperation, DiagramViewBlock,
  TextEdit,
} from '@/compiler/queries/transform';

export { findDiagramViewBlocks } from '@/compiler/queries/transform';
export { fullName } from '@/compiler/queries/transform/utils/arch';

// Dep transform types
export type { DepSyncOperation, DepSyncEdge, DepEndpointRef } from '@/compiler/queries/transform';

// Element identifier types
export type {
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
} from '@/compiler/queries/transform';

export {
  dbmlLanguageConfig,
  dbmlMonarchTokensProvider,
} from '@/services/monarch';

export * from '@/compiler/projectLayout/layout';

export { dbmlModules } from '@/core/global_modules';
export type { GlobalModule } from '@/core/global_modules/types';
export type { ParserOptions } from '@/core/parser/parser';
export type { LexerOptions } from '@/core/lexer/lexer';
export type { DialectOptions } from '@/compiler/index';

export { Compiler };

export * from '@/services';
