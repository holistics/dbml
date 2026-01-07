import type Compiler from '../../index';
import type { SyntaxToken } from '@/core/lexer/tokens';

export type ContainerTokenResult =
  | { token: SyntaxToken; index: number }
  | { token: undefined; index: undefined };

export function token (this: Compiler, offset: number): ContainerTokenResult {
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
