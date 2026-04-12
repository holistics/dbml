import Compiler from '@/compiler/index';
import * as services from '@/services/index';

// Export the types that playground and other consumers need
export { ElementKind } from '@/core/analyzer/types';

export * from '@/core/interpreter/records/utils';

export {
  // Core AST node types
  SyntaxNode,
  ElementDeclarationNode,
  ProgramNode,
  SyntaxNodeKind,
  type SyntaxNodeId,
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
  // Position interface
  type Position,
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

// DiagramView types (methods exposed via Compiler)
export type {
  DiagramViewSyncOperation, DiagramViewBlock,
} from '@/compiler/queries/transform/syncDiagramView';
export type { TextEdit } from '@/compiler/queries/transform/applyTextEdits';

export { dbmlMonarchTokensProvider } from '@/services/monarch';

export {
  Compiler, services,
};
