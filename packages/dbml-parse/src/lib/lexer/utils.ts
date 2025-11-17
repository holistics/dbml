import { last } from 'lodash-es';
import { SyntaxToken, SyntaxTokenKind } from '@/lib/lexer/tokens';

export function hasTrailingNewLines (token: SyntaxToken): boolean {
  return token.trailingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;
}

export function isAtStartOfLine (previous: SyntaxToken, token: SyntaxToken): boolean {
  const hasLeadingNewLines = token.leadingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;

  return hasLeadingNewLines || hasTrailingNewLines(previous);
}

export function hasTrailingSpaces (token: SyntaxToken): boolean {
  return token.trailingTrivia.find(({ kind }) => [SyntaxTokenKind.SPACE, SyntaxTokenKind.TAB].includes(kind)) !== undefined;
}

export function getTokenFullEnd (token: SyntaxToken): number {
  return token.trailingTrivia.length === 0
    ? token.end
    : getTokenFullEnd(last(token.trailingTrivia)!);
}

export function getTokenFullStart (token: SyntaxToken): number {
  return token.leadingTrivia.length === 0 ? token.start : getTokenFullStart(token.leadingTrivia[0]);
}

export function isComment (token: SyntaxToken): boolean {
  return [SyntaxTokenKind.SINGLE_LINE_COMMENT, SyntaxTokenKind.MULTILINE_COMMENT].includes(
    token.kind,
  );
}
