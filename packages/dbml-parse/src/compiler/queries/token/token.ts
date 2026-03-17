import type Compiler from '../../index';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { Filepath } from '../../projectLayout';
import { isInvalidToken } from '@/core/parser/utils';

export function flatTokenStream (this: Compiler, filepath: Filepath): readonly SyntaxToken[] {
  const fi = this.parseFile(filepath);
  return fi.tokens.flatMap((token) => [...token.leadingInvalid, token, ...token.trailingInvalid]);
}

export function invalidTokens (this: Compiler, filepath: Filepath): readonly SyntaxToken[] {
  return this.parseFile(filepath).tokens.filter(isInvalidToken);
}
