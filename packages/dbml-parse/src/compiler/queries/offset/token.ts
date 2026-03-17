import type Compiler from '../../index';
import type { SyntaxToken } from '@/core/lexer/tokens';
import { DEFAULT_ENTRY } from '../../constants';

export function tokenAtOffset (this: Compiler, offset: number): { token: SyntaxToken; index: number } | { token: undefined; index: undefined } {
  const tokens = this.flatTokenStream(DEFAULT_ENTRY);
  const id = tokens.findIndex((t) => t.start >= offset);

  if (id === undefined) {
    return { token: undefined, index: undefined };
  }

  if (id <= 0) {
    return { token: undefined, index: undefined };
  }

  return {
    token: tokens[id - 1],
    index: id - 1,
  };
}
