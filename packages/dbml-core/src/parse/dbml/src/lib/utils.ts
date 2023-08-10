import { SyntaxToken, SyntaxTokenKind } from './lexer/tokens';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  ExpressionNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  NormalFormExpressionNode,
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

export function isPrimaryVariableNode(
  value?: unknown,
): value is PrimaryExpressionNode & { expression: VariableNode } {
  return value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode;
}

export function isIdentifierNode(value?: unknown): boolean {
  return (
    value instanceof PrimaryExpressionNode &&
    value.expression instanceof VariableNode &&
    value.expression.variable.kind === SyntaxTokenKind.IDENTIFIER
  );
}

export function tryInterpretAsLiteralElement(
  callee: ExpressionNode,
  args: NormalFormExpressionNode[],
): ElementDeclarationNode | undefined {
  if (!isIdentifierNode(callee) || args.length === 0) {
    return undefined;
  }

  const type = extractIdentifierFromNode(callee)!;

  let attributeList: ListExpressionNode | undefined;
  let alias: NormalFormExpressionNode | undefined;
  let as: SyntaxToken | undefined;
  let name: NormalFormExpressionNode | undefined;

  const cpArgs = [...args];

  const body = cpArgs.pop();
  if (!(body instanceof BlockExpressionNode)) {
    return undefined;
  }

  if (cpArgs[cpArgs.length - 1] instanceof ListExpressionNode) {
    attributeList = cpArgs.pop() as ListExpressionNode;
  }

  const maybeAlias = cpArgs.pop();
  const maybeAs = cpArgs[cpArgs.length - 1];
  if (extractIdentifierFromNode(maybeAs)?.value === 'as') {
    alias = maybeAlias;
    as = extractIdentifierFromNode(cpArgs.pop());
    name = cpArgs.pop();
  } else {
    name = maybeAlias;
  }

  return cpArgs.length === 0 ?
    new ElementDeclarationNode({
        type,
        name,
        as,
        alias,
        attributeList,
        body,
      }) :
    undefined;
}
