import type Compiler from '../../index';
import type { ProgramNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import Report from '@/core/types/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { DEFAULT_ENTRY } from '@/constants';

export function parseFile (this: Compiler): Report<{
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
}> {
  const source = this.parse.source();
  return new Lexer(source, DEFAULT_ENTRY)
    .lex()
    .chain((lexedTokens) => new Parser(source, lexedTokens, this.nodeIdGenerator, DEFAULT_ENTRY).parse());
}
