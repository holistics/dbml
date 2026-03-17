import type Compiler from '../index';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { isInvalidToken } from '@/core/parser/utils';

export function flatTokenStream (this: Compiler): readonly SyntaxToken[] {
  return [...this.parseProject().values()]
    .flatMap((fi) => fi.tokens)
    .flatMap((token) => [...token.leadingInvalid, token, ...token.trailingInvalid]);
}

export function invalidTokens (this: Compiler): readonly SyntaxToken[] {
  return [...this.parseProject().values()]
    .flatMap((fi) => fi.tokens)
    .filter(isInvalidToken);
}
