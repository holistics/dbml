import Compiler from '@/compiler/index';

export {
  dbmlMonarchTokensProvider,
  dbmlLanguageConfig,
} from '@/services/monarch';

// Export the types that playground and other consumers need
export {
  ElementKind,
} from '@/core/types/keywords';

export * from '@/core/global_modules/records/utils';

export * from '@/core/types/nodes';

export {
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

export {
  DEFAULT_ENTRY,
} from './constants';
export {
  UNHANDLED,
  PASS_THROUGH,
} from '@/core/types/module';

export {
  NodeSymbol,
  SchemaSymbol,
  AliasSymbol,
  UseSymbol,
  InjectedColumnSymbol,
  SymbolKind,
} from '@/core/types/symbol';
export * from '@/core/global_modules/records/utils/data';

export type {
  AliasKind, DiagramView, FilterConfig,
  Table, Note, Column, ColumnType, Index, Check, InlineRef,
  RelationCardinality,
  Enum, EnumField, TableGroup, TablePartial,
  Alias, Project, RecordValue, TokenPosition,
} from '@/core/types/schemaJson';
export type {
  Database, Ref, RefEndpoint, RefEndpointPair, TableRecord,
} from '@/core/types/schemaJson';
export type {
  DiagramViewSyncOperation,
  DiagramViewBlock,
  TextEdit,
} from '@/compiler/queries/transform';
export {
  findDiagramViewBlocks,
} from '@/compiler/queries/transform';

export {
  Filepath,
} from '@/core/types/filepath';
export type {
  DbmlProjectLayout,
} from '@/compiler/projectLayout/layout';
export {
  MemoryProjectLayout,
} from '@/compiler/projectLayout/layout';

export {
  Compiler,
};

export {
  DBMLCompletionItemProvider,
  DBMLDefinitionProvider,
  DBMLReferencesProvider,
  DBMLDiagnosticsProvider,
} from '@/services/index';
