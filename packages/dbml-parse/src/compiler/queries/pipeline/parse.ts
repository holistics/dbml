import type Compiler from '../../index';
import type { ProgramNode } from '@/core/parser/nodes';
import type { SyntaxToken } from '@/core/lexer/tokens';
import Report from '@/core/types/report';
import Lexer from '@/core/lexer/lexer';
import Parser from '@/core/parser/parser';
import { DEFAULT_FILEPATH } from '@/core/types/filepath';

export function parseFile (this: Compiler): Report<{
  readonly ast: Readonly<ProgramNode>;
  readonly tokens: readonly Readonly<SyntaxToken>[];
}> {
  const source = this.parse.source();
  return new Lexer(source, DEFAULT_FILEPATH)
    .lex()
    .chain((lexedTokens) => new Parser(DEFAULT_FILEPATH, source, lexedTokens, this.nodeIdGenerator).parse());
}
