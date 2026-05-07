import {
  getTokenFullEnd, getTokenFullStart,
} from '@/core/lexer/utils';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import {
  SyntaxToken,
} from '@/core/types/tokens';

export function isOffsetWithinFullSpan (
  offset: number,
  nodeOrToken: SyntaxNode | SyntaxToken,
): boolean {
  if (nodeOrToken instanceof SyntaxToken) {
    return offset >= getTokenFullStart(nodeOrToken) && offset < getTokenFullEnd(nodeOrToken);
  }

  return offset >= nodeOrToken.fullStart && offset < nodeOrToken.fullEnd;
}

export function isOffsetWithinSpan (offset: number, nodeOrToken: SyntaxNode | SyntaxToken): boolean {
  return offset >= nodeOrToken.start && offset < nodeOrToken.end;
}
