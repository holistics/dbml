import {
  isInvalidToken,
} from '@/core/parser/utils';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type Compiler from '../../index';

export function flatStream (this: Compiler): readonly SyntaxToken[] {
  return this.parse.tokens()
    .flatMap((token) => [
      ...token.leadingInvalid,
      token,
      ...token.trailingInvalid,
    ]);
}

export function invalidStream (this: Compiler): readonly SyntaxToken[] {
  return this.parse.tokens().filter(isInvalidToken);
}
