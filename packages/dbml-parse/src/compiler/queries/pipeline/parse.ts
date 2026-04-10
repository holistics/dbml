import type Compiler from '../../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import Report from '@/core/types/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';

export function parseFile (this: Compiler): Report<{
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
}> {
  const source = this.parse.source();
  return new Lexer(source)
    .lex()
    .chain((lexedTokens) => new Parser(source, lexedTokens, this.nodeIdGenerator).parse());
}
