import {
  SyntaxNode,
} from '@/core/types/nodes';
import {
  SyntaxToken,
} from '@/core/types/tokens';

export function isOffsetWithinSpan (offset: number, nodeOrToken: SyntaxNode | SyntaxToken): boolean {
  return offset >= nodeOrToken.start && offset < nodeOrToken.end;
}
