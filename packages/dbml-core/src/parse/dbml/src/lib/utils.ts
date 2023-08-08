import { SyntaxToken, SyntaxTokenKind } from './lexer/tokens';
import {
  ExpressionNode,
  InfixExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from './parser/nodes';

export function isAccessExpression(
  node: SyntaxNode,
): node is InfixExpressionNode & { op: SyntaxToken & { value: '.' } } {
  return node instanceof InfixExpressionNode && node.op.value === '.';
}

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

export function extractIdentifierFromNode(value?: unknown): SyntaxToken | undefined {
  if (isIdentifierNode(value)) {
    return ((value as PrimaryExpressionNode).expression as VariableNode).variable;
  }

  return undefined;
}

export function isQuotedStringNode(value?: unknown): boolean {
  return (
    value instanceof PrimaryExpressionNode &&
    ((value.expression instanceof VariableNode &&
      value.expression.variable.kind === SyntaxTokenKind.QUOTED_STRING) ||
      (value.expression instanceof LiteralNode &&
        value.expression.literal.kind === SyntaxTokenKind.STRING_LITERAL))
  );
}

export function isIdentifierNode(value?: unknown): boolean {
  return (
    value instanceof PrimaryExpressionNode &&
    value.expression instanceof VariableNode &&
    value.expression.variable.kind === SyntaxTokenKind.IDENTIFIER
  );
}
