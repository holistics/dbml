import { SyntaxToken } from './lexer/tokens';
import {
  LiteralNode, PrefixExpressionNode, PrimaryExpressionNode, SyntaxNode,
} from './parser/nodes';
import { getTokenFullEnd, getTokenFullStart } from './lexer/utils';

export function isAlphaOrUnderscore (char: string): boolean {
  // Match any letters, accents (some characters are denormalized so the accent and the main character are two separate characters) and underscore
  // \p{L} is used to match letters
  // \p{M} is used to match accents
  // References:
  //   https://unicode.org/Public/UCD/latest/ucd/PropertyValueAliases.txt
  //   https://www.compart.com/en/unicode/category/Mn
  //   https://www.compart.com/en/unicode/category/Me
  //   https://www.compart.com/en/unicode/category/Mc
  return !!char.match(/(\p{L}|_|\p{M})/gu);
}

export function isDigit (char: string): boolean {
  if (!char) return false;
  const c = char[0];

  return c >= '0' && c <= '9';
}

// Check if a character is a valid hexadecimal character
export function isHexChar (char: string): boolean {
  const [c] = char;

  return isDigit(c) || (isAlphaOrUnderscore(c) && c.toLowerCase() >= 'a' && c.toLowerCase() <= 'f');
}

export function isAlphaNumeric (char: string): boolean {
  return isAlphaOrUnderscore(char) || isDigit(char);
}

export function addQuoteIfNeeded (s: string): string {
  return s.split('').every(isAlphaNumeric) ? s : `"${s}"`;
}

export function alternateLists<T, S> (firstList: T[], secondList: S[]): (T | S)[] {
  const res: (T | S)[] = [];
  const minLength = Math.min(firstList.length, secondList.length);
  for (let i = 0; i < minLength; i += 1) {
    res.push(firstList[i], secondList[i]);
  }
  res.push(...firstList.slice(minLength), ...secondList.slice(minLength));

  return res;
}

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

export function getNumberTextFromExpression (node: PrimaryExpressionNode | PrefixExpressionNode): string {
  if (node instanceof PrefixExpressionNode) {
    return `${node.op?.value}${getNumberTextFromExpression(node.expression!)}`;
  }
  return (node.expression as LiteralNode).literal!.value;
}

export function parseNumber (node: PrefixExpressionNode | PrimaryExpressionNode): number {
  if (node instanceof PrefixExpressionNode) {
    const op = node.op?.value;
    if (op === '-') return -parseNumber(node.expression!);
    return parseNumber(node.expression!);
  }
  return Number.parseFloat((node.expression as LiteralNode).literal!.value);
}
