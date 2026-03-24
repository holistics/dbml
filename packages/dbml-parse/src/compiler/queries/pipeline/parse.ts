import type Compiler from '../../index';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator, type ProgramNode } from '@/core/parser/nodes';
import { Filepath } from '../../projectLayout';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { CompileError, CompileWarning } from '@/core/errors';

// The result of lexing and parsing a single .dbml file.
// Only invalidated when the file changes. Should not be modified after creation.
// See: https://www.notion.so/holistics/TDD-91-DBML-multi-file-support-319f89dc7e49804f94f6d8d7cd2cdf6e?source=copy_link#323f89dc7e498039b7bcde3e0b22f9fa
export type FileParseIndex = {
  readonly path: Readonly<Filepath>;
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
  readonly errors: readonly Readonly<CompileError>[];
  readonly warnings: readonly Readonly<CompileWarning>[];
};

export function parseFile (this: Compiler, filepath: Filepath): FileParseIndex {
  const layout = this.layout();
  const source = layout.getSource(filepath) ?? '';
  const nodeIdGenerator = new SyntaxNodeIdGenerator();
  const parseReport = new Lexer(source)
    .lex()
    .chain((tokens) => new Parser(filepath, source, tokens, nodeIdGenerator).parse());

  return {
    path: filepath,
    ast: parseReport.getValue().ast,
    tokens: parseReport.getValue().tokens,
    errors: parseReport.getErrors(),
    warnings: parseReport.getWarnings(),
  };
}
