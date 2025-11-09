import { serialize } from '@serialization/serialize';
import Compiler from '@/compiler';
import * as services from '@services/index';

// Export the types that playground and other consumers need
export {
  // Element types from analyzer
  ElementKind,
} from '@analyzer/types';

export {
  // Core AST node types
  SyntaxNode,
  ElementDeclarationNode,
  ProgramNode,
  SyntaxNodeKind,
  type SyntaxNodeId,
} from '@parser/nodes';

export {
  // Token types
  SyntaxToken,
  SyntaxTokenKind,
} from '@lexer/tokens';

export {
  // Error types
  CompileError,
  CompileErrorCode,
} from '@lib/errors';

export {
  // Position interface
  type Position,
} from '@lib/types';

export {
  // Scope kinds from compiler
  ScopeKind,
} from '@/compiler';

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
} from '@interpreter/types';

export { serialize, Compiler, services };
