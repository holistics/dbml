import _ from 'lodash';
import { None, Option, Some } from '../option';
import {
  ElementDeclarationNode,
  FunctionExpressionNode,
  InfixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '../parser/nodes';
import { isRelationshipOp, isTupleOfVariables } from './validator/utils';
import { NodeSymbolIndex, isPublicSchemaIndex } from './symbol/symbolIndex';
import { NodeSymbol } from './symbol/symbols';
import {
  isAccessExpression,
  isExpressionAQuotedString,
  isExpressionAVariableNode,
} from '../parser/utils';
import { SyntaxToken } from '../lexer/tokens';

export function destructureMemberAccessExpression(node: SyntaxNode): Option<SyntaxNode[]> {
  if (!isAccessExpression(node)) {
    return new Some([node]);
  }

  const fragments = destructureMemberAccessExpression(node.leftExpression).unwrap_or(undefined);

  if (!fragments) {
    return new None();
  }

  fragments.push(node.rightExpression);

  return new Some(fragments);
}

export function destructureComplexVariable(node?: SyntaxNode): Option<string[]> {
  if (node === undefined) {
    return new None();
  }

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

export function destructureComplexTuple(
  node?: SyntaxNode,
): Option<{ variables: string[]; tupleElements?: string[] }> {
  if (node === undefined) {
    return new None();
  }

  const fragments = destructureMemberAccessExpression(node).unwrap_or(undefined);

  if (!fragments || fragments.length === 0) {
    return new None();
  }

  const variables: string[] = [];
  let tupleElements: string[] | undefined;

  if (!isExpressionAVariableNode(_.last(fragments))) {
    const topFragment = fragments.pop()!;
    if (isTupleOfVariables(topFragment)) {
      tupleElements = topFragment.elementList.map((e) =>
        extractVarNameFromPrimaryVariable(e as any).unwrap(),
      );
    } else {
      return new None();
    }
  }

  // eslint-disable-next-line no-restricted-syntax
  for (const fragment of fragments) {
    const variable = extractVariableFromExpression(fragment).unwrap_or(undefined);
    if (!variable) {
      return new None();
    }

    variables.push(variable);
  }

  return new Some({
    variables,
    tupleElements,
  });
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
): Option<string> {
  const value = node.expression.variable?.value;

  return value === undefined ? new None() : new Some(value);
}

export function extractQuotedStringToken(value?: SyntaxNode): Option<string> {
  if (!isExpressionAQuotedString(value)) {
    return new None();
  }

  if (value.expression instanceof VariableNode) {
    return new Some(value.expression.variable!.value);
  }

  return new Some(value.expression.literal.value);
}

export function isBinaryRelationship(value?: SyntaxNode): value is InfixExpressionNode {
  if (!(value instanceof InfixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op?.value)) {
    return false;
  }

  return (
    destructureComplexTuple(value.leftExpression)
      .and_then(() => destructureComplexTuple(value.rightExpression))
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
  value:
    | (PrimaryExpressionNode & { expression: VariableNode & { variable: SyntaxToken } })
    | (FunctionExpressionNode & { value: SyntaxToken }),
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
  let curElement: SyntaxNode | undefined = startElement;
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

    curElement = curElement.parent;
  }

  return undefined;
}
