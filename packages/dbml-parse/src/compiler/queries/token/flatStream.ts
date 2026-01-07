import type Compiler from '../../index';
import type { SyntaxToken } from '@/core/lexer/tokens';

export function flatStream (this: Compiler): readonly SyntaxToken[] {
  return this.parse.tokens()
    .flatMap((token) => [...token.leadingInvalid, token, ...token.trailingInvalid]);
}
