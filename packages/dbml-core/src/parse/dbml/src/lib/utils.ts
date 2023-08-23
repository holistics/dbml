import { SyntaxToken, SyntaxTokenKind } from './lexer/tokens';
import { None, Option, Some } from './option';
import {
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

// Check if a character is a valid hexadecimal character
export function isHexChar(char: string): boolean {
  const [c] = char;

  return isDigit(c) || (isAlphaOrUnderscore(c) && c.toLowerCase() >= 'a' && c.toLowerCase() <= 'f');
}

export function isAlphaNumeric(char: string): boolean {
  return isAlphaOrUnderscore(char) || isDigit(char);
}

// Return a variable node if it's nested inside a primary expression
export function extractVariableNode(value?: unknown): Option<SyntaxToken> {
  if (isExpressionAVariableNode(value)) {
    return new Some(value.expression.variable);
  }

  return new None();
}

// Return true if an expression node is a primary expression
// with a nested quoted string (", ' or ''')
export function isExpressionAQuotedString(value?: unknown): boolean {
  return (
    value instanceof PrimaryExpressionNode &&
    ((value.expression instanceof VariableNode &&
      value.expression.variable.kind === SyntaxTokenKind.QUOTED_STRING) ||
      (value.expression instanceof LiteralNode &&
        value.expression.literal.kind === SyntaxTokenKind.STRING_LITERAL))
  );
}

// Return true if an expression node is a primary expression
// with a variable node (identifier or a double-quoted string)
export function isExpressionAVariableNode(
  value?: unknown,
): value is PrimaryExpressionNode & { expression: VariableNode } {
  return value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode;
}

// Return true if an expression node is a primary expression
// with an identifier-like variable node
export function isExpressionAnIdentifierNode(value?: unknown): value is PrimaryExpressionNode & {
  expression: VariableNode & { variable: { kind: SyntaxTokenKind.IDENTIFIER } };
} {
  return (
    value instanceof PrimaryExpressionNode &&
    value.expression instanceof VariableNode &&
    value.expression.variable.kind === SyntaxTokenKind.IDENTIFIER
  );
}

export function last<T>(array: T[]): T | undefined {
  if (array.length === 0) {
    return undefined;
  }

  return array[array.length - 1];
}
