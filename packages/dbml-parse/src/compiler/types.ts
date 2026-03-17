import type { ProgramNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { CompileError, CompileWarning } from '@/core/errors';
import type { Filepath } from './projectLayout';

// The result of lexing and parsing a single .dbml file.
// Only invalidated when the file changes. Should not be modified after creation.
// See: https://www.notion.so/holistics/TDD-91-DBML-multi-file-support-319f89dc7e49804f94f6d8d7cd2cdf6e?source=copy_link#323f89dc7e498039b7bcde3e0b22f9fa
export interface FileIndex {
  readonly path: Readonly<Filepath>;
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
  readonly errors: readonly Readonly<CompileError>[];
  readonly warnings: readonly Readonly<CompileWarning>[];
}

export const enum ScopeKind {
  TABLE,
  ENUM,
  TABLEGROUP,
  INDEXES,
  NOTE,
  REF,
  PROJECT,
  CUSTOM,
  TOPLEVEL,
  TABLEPARTIAL,
  CHECKS,
  RECORDS,
}
