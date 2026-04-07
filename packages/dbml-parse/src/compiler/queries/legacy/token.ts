import type Compiler from '../../index';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { isInvalidToken } from '@/core/parser/utils';
import type { Filepath } from '@/core/types/filepath';

export function flatStream (this: Compiler, filepath: Filepath): readonly SyntaxToken[] {
  return (this.parse(filepath).getValue().tokens as SyntaxToken[])
    .flatMap((token: SyntaxToken) => [...token.leadingInvalid, token, ...token.trailingInvalid]);
}

export function invalidStream (this: Compiler, filepath: Filepath): readonly SyntaxToken[] {
  return (this.parse(filepath).getValue().tokens).filter(isInvalidToken);
}
