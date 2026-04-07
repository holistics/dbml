import type Compiler from '../index';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { isInvalidToken } from '@/core/parser/utils';

export function flatStream (this: Compiler): readonly SyntaxToken[] {
  return (this.parseFile().getValue().tokens as SyntaxToken[])
    .flatMap((token: SyntaxToken) => [...token.leadingInvalid, token, ...token.trailingInvalid]);
}

export function invalidStream (this: Compiler): readonly SyntaxToken[] {
  return (this.parseFile().getValue().tokens as SyntaxToken[]).filter(isInvalidToken);
}
