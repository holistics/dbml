import { SyntaxToken } from '@/core/types/tokens';
import { SyntaxNode } from '@/core/types/nodes';
import { getTokenFullEnd, getTokenFullStart } from '@/core/lexer/utils';

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

export function returnIfIsOffsetWithinFullSpan (
  offset: number,
  node?: SyntaxNode,
): SyntaxNode | undefined;
export function returnIfIsOffsetWithinFullSpan (
  offset: number,
  token?: SyntaxToken,
): SyntaxToken | undefined;
export function returnIfIsOffsetWithinFullSpan (
  offset: number,
  nodeOrToken?: SyntaxNode | SyntaxToken,
): SyntaxNode | SyntaxToken | undefined {
  if (!nodeOrToken) {
    return undefined;
  }

  return isOffsetWithinFullSpan(offset, nodeOrToken) ? nodeOrToken : undefined;
}
