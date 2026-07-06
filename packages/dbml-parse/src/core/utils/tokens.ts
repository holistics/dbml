import {
  type SyntaxToken,
  SyntaxTokenKind,
} from '../types/tokens';

// Check if a token is an `as` keyword
export function isAsKeyword (
  token?: SyntaxToken,
): token is SyntaxToken & {
  kind: SyntaxTokenKind.IDENTIFIER;
  value: 'as';
} {
  return token?.kind === SyntaxTokenKind.IDENTIFIER && token.value.toLowerCase() === 'as';
}

// Check if a token is the `use` keyword (case-insensitive)
export function isUseKeyword (
  token?: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER } {
  return token?.kind === SyntaxTokenKind.IDENTIFIER && token.value.toLowerCase() === 'use';
}

// Check if a token is the `from` keyword (case-insensitive)
export function isFromKeyword (
  token?: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER } {
  return token?.kind === SyntaxTokenKind.IDENTIFIER && token.value.toLowerCase() === 'from';
}

// Check if a token is the `reuse` keyword (case-insensitive)
export function isReuseKeyword (
  token?: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER } {
  return token?.kind === SyntaxTokenKind.IDENTIFIER && token.value.toLowerCase() === 'reuse';
}

export function isInvalidToken (token?: SyntaxToken): boolean {
  return !!token?.isInvalid;
}
