import { SyntaxToken } from '@/core/lexer/tokens';
import { SyntaxNode } from '@/core/parser/nodes';
import { getTokenFullEnd, getTokenFullStart } from '@/utils/token';

// True if offset falls within the full span (including trivia)
export function isOffsetWithinFullSpan (
  offset: number,
  nodeOrToken: SyntaxNode | SyntaxToken,
): boolean {
  if (nodeOrToken instanceof SyntaxToken) {
    return offset >= getTokenFullStart(nodeOrToken) && offset < getTokenFullEnd(nodeOrToken);
  }

  return offset >= nodeOrToken.fullStart && offset < nodeOrToken.fullEnd;
}

// True if offset falls within the token/node's exact span
export function isOffsetWithinSpan (offset: number, nodeOrToken: SyntaxNode | SyntaxToken): boolean {
  return offset >= nodeOrToken.start && offset < nodeOrToken.end;
}

// Returns the node/token if the offset is within its full span, else undefined
export function getIfWithinFullSpan (
  offset: number,
  node?: SyntaxNode,
): SyntaxNode | undefined;
export function getIfWithinFullSpan (
  offset: number,
  token?: SyntaxToken,
): SyntaxToken | undefined;
export function getIfWithinFullSpan (
  offset: number,
  nodeOrToken?: SyntaxNode | SyntaxToken,
): SyntaxNode | SyntaxToken | undefined {
  if (!nodeOrToken) {
    return undefined;
  }

  return isOffsetWithinFullSpan(offset, nodeOrToken) ? nodeOrToken : undefined;
}
