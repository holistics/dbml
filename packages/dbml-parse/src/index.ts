import Compiler from '@/compiler/index';
export { dbmlMonarchTokensProvider } from '@/services/monarch';
export type { Database } from '@/core/types/schemaJson';

// Export the types that playground and other consumers need
export {
  ElementKind,
} from '@/core/types/keywords';

export {
  // Core AST node types
  SyntaxNode,
  ElementDeclarationNode,
  ProgramNode,
  SyntaxNodeKind,
} from '@/core/parser/nodes';

export {
  // Token types
  SyntaxToken,
  SyntaxTokenKind,
} from '@/core/types/tokens';

export {
  // Error types
  CompileError,
  CompileErrorCode,
  CompileWarning,
} from '@/core/types/errors';

export {
  NodeSymbol,
  SymbolKind,
  SchemaSymbol,
  InjectedColumnSymbol,
} from '@/core/types/symbols/symbols';

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

export * from '@/core/global_modules/records/utils/data';

export { Filepath } from '@/core/types/filepath';
export { DEFAULT_ENTRY, DBML_EXT } from '@/constants';
export { type Position } from '@/core/types/position';
export { Compiler };
export { default as DBMLDiagnosticsProvider } from '@/services/diagnostics/provider';
