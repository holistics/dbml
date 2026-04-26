import {
  Filepath,
} from '@/core/types';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import {
  isInvalidToken,
} from '@/core/parser/utils';
import type Compiler from '../../index';

export function flatStream (
  this: Compiler,
  filepath: Filepath,
): readonly SyntaxToken[] {
  return this.parse.tokens(filepath)
    .flatMap((token) => [
      ...token.leadingInvalid,
      token,
      ...token.trailingInvalid,
    ]);
}

export function invalidStream (
  this: Compiler,
  filepath: Filepath,
): readonly SyntaxToken[] {
  return this.parse.tokens(filepath).filter(isInvalidToken);
}
