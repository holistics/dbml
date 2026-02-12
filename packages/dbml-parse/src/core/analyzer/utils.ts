import { last } from 'lodash-es';
import { None, Option, Some } from '@/core/option';
import {
  ElementDeclarationNode,
  FunctionExpressionNode,
  InfixExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
  CallExpressionNode,
} from '@/core/parser/nodes';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { isRelationshipOp, isTupleOfVariables } from '@/core/analyzer/validator/utils';
import { NodeSymbolIndex, isPublicSchemaIndex } from '@/core/analyzer/symbol/symbolIndex';
import { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import {
  isAccessExpression,
  isExpressionAQuotedString,
  isExpressionAVariableNode,
} from '@/core/parser/utils';
import { ElementKind } from '@/core/analyzer/types';

export function getElementKind (node?: ElementDeclarationNode): Option<ElementKind> {
  const kind = node?.type?.value.toLowerCase();
  switch (kind as ElementKind | undefined) {
    case ElementKind.Enum:
    case ElementKind.Table:
    case ElementKind.Indexes:
    case ElementKind.Note:
    case ElementKind.Project:
    case ElementKind.Ref:
    case ElementKind.TableGroup:
    case ElementKind.TablePartial:
    case ElementKind.Check:
    case ElementKind.Records:
    case ElementKind.Policy:
      return new Some(kind as ElementKind);
    default:
      return new None();
  }
}

export function destructureMemberAccessExpression (node?: SyntaxNode): Option<SyntaxNode[]> {
  if (!node) return new None();

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

export function destructureComplexVariable (node?: SyntaxNode): Option<string[]> {
  if (node === undefined) {
    return new None();
  }

  const fragments = destructureMemberAccessExpression(node).unwrap_or(undefined);

  if (!fragments) {
    return new None();
  }

  const variables: string[] = [];

  for (const fragment of fragments) {
    const variable = extractVariableFromExpression(fragment).unwrap_or(undefined);
    if (typeof variable !== 'string') {
      return new None();
    }

    variables.push(variable);
  }

  return new Some(variables);
}

export function destructureComplexVariableTuple (
  node?: SyntaxNode,
): Option<{ variables: (PrimaryExpressionNode & { expression: VariableNode })[]; tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[] }> {
  if (node === undefined) {
    return new None();
  }

  const fragments = destructureMemberAccessExpression(node).unwrap_or(undefined);

  if (!fragments || fragments.length === 0) {
    return new None();
  }

  let tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[] = [];

  if (!isExpressionAVariableNode(last(fragments))) {
    const topFragment = fragments.pop()!;
    if (isTupleOfVariables(topFragment)) {
      tupleElements = topFragment.elementList;
    } else {
      return new None();
    }
  }

  const variables = fragments;
  if (!variables.every(isExpressionAVariableNode)) {
    return new None();
  }

  return new Some({
    variables,
    tupleElements,
  });
}

export function extractVariableFromExpression (node?: SyntaxNode): Option<string> {
  if (!isExpressionAVariableNode(node)) {
    return new None();
  }

  return new Some(node.expression.variable.value);
}

export function destructureIndexNode (node?: SyntaxNode): Option<{
  functional: FunctionExpressionNode[];
  nonFunctional: (PrimaryExpressionNode & { expression: VariableNode })[];
}> {
  if (isValidIndexName(node)) {
    return node instanceof FunctionExpressionNode
      ? new Some({ functional: [node], nonFunctional: [] })
      : new Some({ functional: [], nonFunctional: [node] });
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

export function extractVarNameFromPrimaryVariable (
  node?: PrimaryExpressionNode & { expression: VariableNode },
): Option<string> {
  const value = node?.expression.variable?.value;

  return value === undefined ? new None() : new Some(value);
}

export function extractQuotedStringToken (value?: SyntaxNode): Option<string> {
  if (!isExpressionAQuotedString(value)) {
    return new None();
  }

  if (value.expression instanceof VariableNode) {
    return new Some(value.expression.variable!.value);
  }

  return new Some(value.expression.literal.value);
}

export function extractNumericLiteral (node?: SyntaxNode): number | null {
  if (node instanceof PrimaryExpressionNode && node.expression instanceof LiteralNode) {
    if (node.expression.literal?.kind === SyntaxTokenKind.NUMERIC_LITERAL) {
      return Number(node.expression.literal.value);
    }
  }
  return null;
}

// Extract referee from a simple variable (x) or complex variable (a.b.c)
// For complex variables, returns the referee of the rightmost part
export function extractReferee (node?: SyntaxNode): NodeSymbol | undefined {
  if (!node) return undefined;

  // Simple variable: x
  if (isExpressionAVariableNode(node)) {
    return node.referee;
  }

  // Complex variable: a.b.c - get referee from rightmost part
  if (node instanceof InfixExpressionNode && node.op?.value === '.') {
    return extractReferee(node.rightExpression);
  }

  return node.referee;
}

export function isBinaryRelationship (value?: SyntaxNode): value is InfixExpressionNode {
  if (!(value instanceof InfixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op?.value)) {
    return false;
  }

  return (
    destructureComplexVariableTuple(value.leftExpression)
      .and_then(() => destructureComplexVariableTuple(value.rightExpression))
      .unwrap_or(undefined) !== undefined
  );
}

export function isEqualTupleOperands (value: InfixExpressionNode): value is InfixExpressionNode {
  const leftRes = destructureComplexVariableTuple(value.leftExpression);
  const rightRes = destructureComplexVariableTuple(value.rightExpression);

  if (!leftRes.isOk() || !rightRes.isOk()) {
    return false;
  }

  const { tupleElements: leftTuple } = leftRes.unwrap();
  const { tupleElements: rightTuple } = rightRes.unwrap();

  if (leftTuple?.length !== rightTuple?.length) {
    return false;
  }

  return true;
}

export function isValidIndexName (
  value?: SyntaxNode,
): value is (PrimaryExpressionNode & { expression: VariableNode }) | FunctionExpressionNode {
  return (
    (value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode)
    || value instanceof FunctionExpressionNode
  );
}

export function extractIndexName (
  value:
    | (PrimaryExpressionNode & { expression: VariableNode & { variable: SyntaxToken } })
    | (FunctionExpressionNode & { value: SyntaxToken }),
): string {
  if (value instanceof PrimaryExpressionNode) {
    return value.expression.variable.value;
  }

  return value.value.value;
}

// Destructure a call expression like `schema.table(col1, col2)` or `table(col1, col2)`.
// Returns the callee variables (schema, table) and the args (col1, col2).
//   schema.table(col1, col2) => { variables: [schema, table], args: [col1, col2] }
//   table(col1, col2)        => { variables: [table], args: [col1, col2] }
//   table()                  => { variables: [table], args: [] }
export function destructureCallExpression (
  node?: SyntaxNode,
): Option<{ variables: (PrimaryExpressionNode & { expression: VariableNode })[]; args: (PrimaryExpressionNode & { expression: VariableNode })[] }> {
  if (!(node instanceof CallExpressionNode) || !node.callee) {
    return new None();
  }

  // Destructure the callee (e.g., schema.table or just table)
  const fragments = destructureMemberAccessExpression(node.callee).unwrap_or(undefined);
  if (!fragments || fragments.length === 0) {
    return new None();
  }

  // All callee fragments must be simple variables
  if (!fragments.every(isExpressionAVariableNode)) {
    return new None();
  }

  // Get args from argument list
  let args: (PrimaryExpressionNode & { expression: VariableNode })[] = [];
  if (isTupleOfVariables(node.argumentList)) {
    args = [...node.argumentList.elementList];
  }

  return new Some({
    variables: fragments as (PrimaryExpressionNode & { expression: VariableNode })[],
    args,
  });
}

// Starting from `startElement`
// find the closest outer scope that contains `id`
// and return the symbol corresponding to `id` in that scope
export function findSymbol (
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

    curElement = curElement.parent;
  }

  return undefined;
}
