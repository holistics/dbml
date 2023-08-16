import { isAccessExpression, isExpressionAVariableNode, isExpressionAQuotedString } from '../utils';
import { None, Option, Some } from '../option';
import {
  FunctionExpressionNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '../parser/nodes';
import { isRelationshipOp } from './validator/utils';
import { SyntaxToken } from '../lexer/tokens';

export function destructureMemberAccessExpression(node: SyntaxNode): Option<SyntaxNode[]> {
  if (node instanceof PrimaryExpressionNode || node instanceof TupleExpressionNode) {
    return new Some([node]);
  }

  if (!isAccessExpression(node)) {
    return new None();
  }

  const fragments = destructureMemberAccessExpression(node.leftExpression).unwrap_or(undefined);

  if (!fragments) {
    return new None();
  }

  fragments.push(node.rightExpression);

  return new Some(fragments);
}

export function destructureComplexVariable(node: SyntaxNode): Option<string[]> {
  const fragments = destructureMemberAccessExpression(node).unwrap_or(undefined);

  if (!fragments) {
    return new None();
  }

  const variables: string[] = [];

  // eslint-disable-next-line no-restricted-syntax
  for (const fragment of fragments) {
    const variable = extractVariableFromExpression(fragment).unwrap_or(undefined);
    if (!variable) {
      return new None();
    }

    variables.push(variable);
  }

  return new Some(variables);
}

export function extractVariableFromExpression(node: SyntaxNode): Option<string> {
  if (!isExpressionAVariableNode(node)) {
    return new None();
  }

  return new Some(node.expression.variable.value);
}

export function destructureIndex(
  node: SyntaxNode,
): Option<{ functional: string[]; nonFunctional: string[] }> {
  if (isValidIndexName(node)) {
    const indexName = extractIndexName(node);

    return node instanceof FunctionExpressionNode ?
      new Some({ functional: [indexName], nonFunctional: [] }) :
      new Some({ functional: [], nonFunctional: [indexName] });
  }

  if (node instanceof TupleExpressionNode && node.elementList.every(isValidIndexName)) {
    const functionalIndexName = node.elementList
      .filter((e) => e instanceof FunctionExpressionNode)
      .map(extractIndexName);
    const nonfunctionalIndexName = node.elementList
      .filter(isExpressionAVariableNode)
      .map(extractIndexName);

    return new Some({ functional: functionalIndexName, nonFunctional: nonfunctionalIndexName });
  }

  return new None();
}

export function extractVarNameFromPrimaryVariable(
  node: PrimaryExpressionNode & { expression: VariableNode },
): string {
  return node.expression.variable.value;
}

export function extractStringFromIdentifierStream(stream: IdentiferStreamNode): string {
  return stream.identifiers.map((identifier) => identifier.value).join(' ');
}

export function extractQuotedStringToken(value?: SyntaxNode): string | undefined {
  if (!isExpressionAQuotedString(value)) {
    return undefined;
  }

  const primaryExp = value as PrimaryExpressionNode;
  if (primaryExp.expression instanceof VariableNode) {
    return primaryExp.expression.variable.value;
  }

  if (primaryExp.expression instanceof LiteralNode) {
    return primaryExp.expression.literal.value;
  }

  return undefined; // unreachable
}

export function isBinaryRelationship(value?: SyntaxNode): boolean {
  if (!(value instanceof InfixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op.value)) {
    return false;
  }

  return (
    destructureComplexVariable(value.leftExpression)
      .and_then(() => destructureComplexVariable(value.rightExpression))
      .unwrap_or(undefined) !== undefined
  );
}

export function isValidIndexName(
  value?: SyntaxNode,
): value is (PrimaryExpressionNode & { expression: VariableNode }) | FunctionExpressionNode {
  return (
    (value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode) ||
    value instanceof FunctionExpressionNode
  );
}

export function extractIndexName(
  value: (PrimaryExpressionNode & { expression: VariableNode }) | FunctionExpressionNode,
): string {
  if (value instanceof PrimaryExpressionNode) {
    return value.expression.variable.value;
  }

  return value.value.value;
}
