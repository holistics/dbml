import type Compiler from '../../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import Report from '@/core/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type { Filepath } from '@/core/types/filepath';

export type FileParseIndex = {
  readonly path: Readonly<Filepath>;
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
};

export function parse (this: Compiler, filepath: Filepath): Report<FileParseIndex> {
  const source = this.layout.getSource(filepath);
  return new Lexer(source ?? '', filepath)
    .lex()
    .chain((lexedTokens) => new Parser(filepath, source ?? '', lexedTokens, this.nodeIdGenerator).parse())
    .map(({ ast, tokens }) => ({
      ast,
      tokens,
      path: filepath,
    }));
}
