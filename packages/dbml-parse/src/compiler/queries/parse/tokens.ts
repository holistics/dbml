import type Compiler from '../../index';
import type { SyntaxToken } from '@/core/lexer/tokens';

export function tokens (this: Compiler): Readonly<SyntaxToken>[] {
  return this.parse._().getValue().tokens;
}
