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
