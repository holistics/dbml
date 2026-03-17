import type Compiler from '../../index';
import type { SyntaxToken } from '@/core/lexer/tokens';

export function tokenAtOffset (this: Compiler, offset: number): { token: SyntaxToken; index: number } | { token: undefined; index: undefined } {
  const id = this.flatTokenStream().findIndex((t) => t.start >= offset);

  if (id === undefined) {
    return { token: undefined, index: undefined };
  }

  if (id <= 0) {
    return { token: undefined, index: undefined };
  }

  return {
    token: this.flatTokenStream()[id - 1],
    index: id - 1,
  };
}
