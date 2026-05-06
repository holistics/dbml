import Compiler from '@/compiler/index';

// Export the types that playground and other consumers need
export {
  DEFAULT_ENTRY,
} from '@/constants';

export {
  Filepath,
} from '@/core/types/filepath';

export {
  UNHANDLED,
  type Unhandled,
} from '@/core/types/module';

export {
  ElementKind,
} from '@/core/types/keywords';

export {
  type NodeSymbol,
  SymbolKind,
} from '@/core/types/symbol';

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
  type RelationCardinality,
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
} from '@/core/types/schemaJson';

// DiagramView types
export type {
  DiagramViewSyncOperation, DiagramViewBlock,
  TextEdit,
} from '@/compiler/queries/transform';

export {
  dbmlLanguageConfig,
  dbmlMonarchTokensProvider,
} from '@/services/monarch';

export {
  Compiler,
};

export * from '@/services';
