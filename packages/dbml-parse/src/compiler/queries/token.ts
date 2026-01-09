import type Compiler from '../index';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { isInvalidToken } from '@/core/parser/utils';

export function flatStream (this: Compiler): readonly SyntaxToken[] {
  return this.parse.tokens()
    .flatMap((token) => [...token.leadingInvalid, token, ...token.trailingInvalid]);
}

export function invalidStream (this: Compiler): readonly SyntaxToken[] {
  return this.parse.tokens().filter(isInvalidToken);
}
