import Compiler from '@/compiler/index';
export { dbmlMonarchTokensProvider } from '@/services/monarch';

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

export * from '@/core/global_modules/records/utils/data';

export type { Database } from '@/core/types/schemaJson';

export { Compiler };
