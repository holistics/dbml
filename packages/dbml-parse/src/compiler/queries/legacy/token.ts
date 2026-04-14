import {
  DEFAULT_ENTRY,
} from '@/constants';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  isInvalidToken,
} from '@/core/utils/expression';
import type Compiler from '../../index';

export function flatStream (this: Compiler): readonly SyntaxToken[] {
  return (this.parseFile(DEFAULT_ENTRY).getValue().tokens)
    .flatMap((token: SyntaxToken) => [
      ...token.leadingInvalid,
      token,
      ...token.trailingInvalid,
    ]);
}

export function invalidStream (this: Compiler): readonly SyntaxToken[] {
  return (this.parseFile(DEFAULT_ENTRY).getValue().tokens).filter(isInvalidToken);
}
