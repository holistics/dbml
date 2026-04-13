import Compiler from '@/compiler/index';
export {
  dbmlMonarchTokensProvider,
} from '@/services/monarch';

// Export the types that playground and other consumers need
export {
  ElementKind,
} from '@/core/types/keywords';

export * from '@/core/global_modules/records/utils';

export {
  // Core AST node types
  SyntaxNode,
  ElementDeclarationNode,
  ProgramNode,
  SyntaxNodeKind,
} from '@/core/types/nodes';

export {
  // Token types
  SyntaxToken,
  SyntaxTokenKind,
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
export * from '@/core/global_modules/records/utils/data';

export type {
  Database, AliasKind, DiagramView, FilterConfig,
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
