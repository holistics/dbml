import { None, Option, Some } from '../option';
import {
  ElementDeclarationNode,
  FunctionExpressionNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '../parser/nodes';
import { isRelationshipOp } from './validator/utils';
import { NodeSymbolIndex, isPublicSchemaIndex } from './symbol/symbolIndex';
import { NodeSymbol } from './symbol/symbols';
import {
  isAccessExpression,
  isExpressionAQuotedString,
  isExpressionAVariableNode,
} from '../parser/utils';

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

export function destructureIndexNode(node: SyntaxNode): Option<{
  functional: FunctionExpressionNode[];
  nonFunctional: (PrimaryExpressionNode & { expression: VariableNode })[];
}> {
  if (isValidIndexName(node)) {
    return node instanceof FunctionExpressionNode ?
      new Some({ functional: [node], nonFunctional: [] }) :
      new Some({ functional: [], nonFunctional: [node] });
  }

  if (node instanceof TupleExpressionNode && node.elementList.every(isValidIndexName)) {
    const functionalIndexName = node.elementList.filter(
      (e) => e instanceof FunctionExpressionNode,
    ) as FunctionExpressionNode[];
    const nonfunctionalIndexName = node.elementList.filter(isExpressionAVariableNode);

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

// Starting from `startElement`
// find the closest outer scope that contains `id`
// and return the symbol corresponding to `id` in that scope
export function findSymbol(
  id: NodeSymbolIndex,
  startElement: ElementDeclarationNode,
): NodeSymbol | undefined {
  let curElement: ElementDeclarationNode | ProgramNode | undefined = startElement;
  const isPublicSchema = isPublicSchemaIndex(id);

  while (curElement) {
    if (curElement.symbol?.symbolTable?.has(id)) {
      return curElement.symbol.symbolTable?.get(id);
    }

    if (curElement.symbol?.declaration instanceof ProgramNode && isPublicSchema) {
      return curElement.symbol;
    }

    if (curElement instanceof ProgramNode) {
      return undefined;
    }

    curElement = curElement.parentElement;
  }

  return undefined;
}
