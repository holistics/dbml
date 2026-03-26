import type Compiler from '../index';
import type { SyntaxToken } from '@/core/lexer/tokens';
import type { Filepath } from '../projectLayout';
import { isInvalidToken } from '@/core/parser/utils';

export function flatStream (this: Compiler, filepath: Filepath): readonly SyntaxToken[] {
  const { tokens } = this.parseFile(filepath).getValue();
  return tokens.flatMap((token) => [...token.leadingInvalid, token, ...token.trailingInvalid]);
}

export function invalidStream (this: Compiler, filepath: Filepath): readonly SyntaxToken[] {
  return this.parseFile(filepath).getValue().tokens.filter(isInvalidToken);
}
