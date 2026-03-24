import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import type { SyntaxToken } from '@/core/lexer/tokens';

export function containerToken (this: Compiler, offset: number, filepath: Filepath): { token: SyntaxToken; index: number } | { token: undefined; index: undefined } {
  const tokens = this.token.flatStream(filepath);
  const id = tokens.findIndex((t) => t.start >= offset);

  if (id <= 0) {
    return { token: undefined, index: undefined };
  }

  return {
    token: tokens[id - 1],
    index: id - 1,
  };
}
