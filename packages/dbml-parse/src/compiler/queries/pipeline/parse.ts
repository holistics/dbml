import type Compiler from '../../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type Report from '@/core/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import type { Filepath } from '@/core/types/filepath';

export function parseFile (this: Compiler, filepath: Filepath): Report<{
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
}> {
  const source = this.parse.source();
  return new Lexer(source)
    .lex()
    .chain((lexedTokens) => new Parser(filepath, source, lexedTokens, this.nodeIdGenerator).parse());
}
