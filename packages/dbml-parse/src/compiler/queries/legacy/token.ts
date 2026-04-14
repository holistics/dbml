import {
  type Filepath,
} from '@/core/types/filepath';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  isInvalidToken,
} from '@/core/utils/expression';
import type Compiler from '../../index';

export function flatStream (this: Compiler, filepath: Filepath): readonly SyntaxToken[] {
  return (this.parseFile(filepath).getValue().tokens)
    .flatMap((token: SyntaxToken) => [
      ...token.leadingInvalid,
      token,
      ...token.trailingInvalid,
    ]);
}

export function invalidStream (this: Compiler, filepath: Filepath): readonly SyntaxToken[] {
  return (this.parseFile(filepath).getValue().tokens).filter(isInvalidToken);
}
