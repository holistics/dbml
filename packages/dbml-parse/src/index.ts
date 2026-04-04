import Compiler from '@/compiler/index';
// TODO: migrate services
// import * as services from '@/services/index';

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
} from '@/core/lexer/tokens';

export {
  // Error types
  CompileError,
  CompileErrorCode,
} from '@/core/errors';

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

export { Compiler };
