import { serialize } from '@/core/serialization/serialize';
import Compiler from '@/compiler/index';
import * as services from '@/services/index';

// Export the types that playground and other consumers need
export {
  ElementKind,
} from '@/core/analyzer/types';

export * from '@/core/interpreter/records/utils';

export {
  // Core AST node types
  SyntaxNode,
  ElementDeclarationNode,
  ProgramNode,
  SyntaxNodeKind,
  type SyntaxNodeId,
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
  // Position interface
  type Position,
} from '@/core/types';

export {
  addQuoteIfNeeded,
} from '@/core/utils';

export {
  // Scope kinds from compiler
  ScopeKind,
  // Utilities
  splitQualifiedIdentifier,
  unescapeString,
  escapeString,
} from '@/compiler/index';

// Export interpreted types for structured data
export {
  type Database,
  type Table,
  type Column,
  type Enum,
  type Ref,
  type Project,
  type TableGroup,
  type TablePartial,
} from '@/core/interpreter/types';

export { serialize, Compiler, services };
