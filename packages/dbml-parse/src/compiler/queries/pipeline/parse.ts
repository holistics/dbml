import type Compiler from '../../index';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type { ProgramNode } from '@/core/parser/nodes';
import { Filepath } from '../../projectLayout';
import type { SyntaxToken } from '@/core/lexer/tokens';
import Report from '@/core/report';

export type FileParseIndex = {
  readonly path: Readonly<Filepath>;
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
};

export function parseFile (this: Compiler, filepath: Filepath): Report<FileParseIndex> {
  const layout = this.layout();
  const source = layout.getSource(filepath) ?? '';
  return new Lexer(source, filepath)
    .lex()
    .chain((tokens) => new Parser(filepath, source, tokens, this.nodeIdGenerator).parse())
    .map(({ ast, tokens }) => ({ path: filepath, ast, tokens }));
}
