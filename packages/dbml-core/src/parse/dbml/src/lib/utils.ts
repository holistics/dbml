import { SyntaxToken } from './lexer/tokens';

export function isAlphaOrUnderscore(char: string): boolean {
  const [c] = char;

  return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || c === '_';
}

export function isDigit(char: string): boolean {
  const [c] = char;

  return c >= '0' && c <= '9';
}

export function isHexChar(char: string): boolean {
  return (
    isDigit(char) ||
    (isAlphaOrUnderscore(char) && char.toLowerCase() >= 'a' && char.toLowerCase() <= 'f')
  );
}

export function isAlphaNumeric(char: string): boolean {
  return isAlphaOrUnderscore(char) || isDigit(char);
}

export function findEnd(token: SyntaxToken): number {
  return token.offset + token.length;
}
