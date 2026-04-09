import type Compiler from '../../index';
import type { SyntaxToken } from '@/core/lexer/tokens';

export function containerToken (this: Compiler, offset: number): { token: SyntaxToken; index: number } | { token: undefined; index: undefined } {
  const id = this.token.flatStream().findIndex((t) => t.start >= offset);

  if (id === undefined) {
    return { token: undefined, index: undefined };
  }

  if (id <= 0) {
    return { token: undefined, index: undefined };
  }

  return {
    token: this.token.flatStream()[id - 1],
    index: id - 1,
  };
}
