import { last } from 'lodash-es';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';

// True if the token has trailing newline trivia
export function hasTrailingNewLines (token: SyntaxToken): boolean {
  return token.trailingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;
}

// True if the token has trailing space or tab trivia
export function hasTrailingSpaces (token: SyntaxToken): boolean {
  return token.trailingTrivia.find(({ kind }) => [SyntaxTokenKind.SPACE, SyntaxTokenKind.TAB].includes(kind)) !== undefined;
}

// True if token starts a new line (preceded by a newline)
export function isAtStartOfLine (previous: SyntaxToken, token: SyntaxToken): boolean {
  const hasLeadingNewLines = token.leadingTrivia.find(({ kind }) => kind === SyntaxTokenKind.NEWLINE) !== undefined;

  return hasLeadingNewLines || hasTrailingNewLines(previous);
}

// End offset of the token including all trailing trivia
export function getTokenFullEnd (token: SyntaxToken): number {
  return token.trailingTrivia.length === 0
    ? token.end
    : getTokenFullEnd(last(token.trailingTrivia)!);
}

// Start offset of the token including all leading trivia
export function getTokenFullStart (token: SyntaxToken): number {
  return token.leadingTrivia.length === 0 ? token.start : getTokenFullStart(token.leadingTrivia[0]);
}

// True if the token is a single-line or multiline comment
export function isComment (token: SyntaxToken): boolean {
  return [SyntaxTokenKind.SINGLE_LINE_COMMENT, SyntaxTokenKind.MULTILINE_COMMENT].includes(
    token.kind,
  );
}
