import { last } from 'lodash-es';
import { None, Option, Some } from '@/core/option';
import {
  ArrayNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionExpressionNode,
  InfixExpressionNode,
  LiteralNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '@/core/parser/nodes';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { NodeSymbolIndex, isPublicSchemaIndex } from '@/core/analyzer/symbol/symbolIndex';
import { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { ElementKind } from '@/core/analyzer/types';
import { NUMERIC_LITERAL_PREFIX } from '@/constants';
import {
  isAccessExpression,
  isQuotedStringExpression,
  isVariableExpression,
  isIdentifierExpression,
  isDotDelimitedIdentifier,
  isTupleOfVariables,
  isRelationshipOp,
} from '@/utils/node';
import {
  isSignedNumberExpression,
} from '@/utils/element';

// Returns the ElementKind for a declaration node, if recognized
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
      return new Some(kind as ElementKind);
    default:
      return new None();
  }
}

// Splits a member-access chain (a.b.c) into an array of sub-expressions
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

// Extracts dot-path component strings from a member-access expression
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

// Splits a complex variable expression into path variables and optional tuple elements
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

  if (!isVariableExpression(last(fragments))) {
    const topFragment = fragments.pop()!;
    if (isTupleOfVariables(topFragment)) {
      tupleElements = topFragment.elementList;
    } else {
      return new None();
    }
  }

  const variables = fragments;
  if (!variables.every(isVariableExpression)) {
    return new None();
  }

  return new Some({
    variables,
    tupleElements,
  });
}

// Extracts the identifier string from a simple variable expression
export function extractVariableFromExpression (node?: SyntaxNode): Option<string> {
  if (!isVariableExpression(node)) {
    return new None();
  }

  return new Some(node.expression.variable.value);
}

// Splits an index node into functional and non-functional parts
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
    const nonfunctionalIndexName = node.elementList.filter(isVariableExpression);

    return new Some({ functional: functionalIndexName, nonFunctional: nonfunctionalIndexName });
  }

  return new None();
}

// Extracts the token value string from a primary variable node
export function extractVariableName (
  node?: PrimaryExpressionNode & { expression: VariableNode },
): Option<string> {
  const value = node?.expression.variable?.value;

  return value === undefined ? new None() : new Some(value);
}

// Extracts the raw value string from a quoted-string expression
export function extractQuotedStringToken (value?: SyntaxNode): Option<string> {
  if (!isQuotedStringExpression(value)) {
    return new None();
  }

  if (value.expression instanceof VariableNode) {
    return new Some(value.expression.variable!.value);
  }

  return new Some(value.expression.literal.value);
}

// Extracts the numeric value from a numeric literal expression
export function extractNumericLiteral (node?: SyntaxNode): number | null {
  if (node instanceof PrimaryExpressionNode && node.expression instanceof LiteralNode) {
    if (node.expression.literal?.kind === SyntaxTokenKind.NUMERIC_LITERAL) {
      return Number(node.expression.literal.value);
    }
  }
  return null;
}

// Returns the bound symbol for a variable or the rightmost member in an access expression
export function extractReferee (node?: SyntaxNode): NodeSymbol | undefined {
  if (!node) return undefined;

  // Simple variable: x
  if (isVariableExpression(node)) {
    return node.referee;
  }

  // Complex variable: a.b.c - get referee from rightmost part
  if (node instanceof InfixExpressionNode && node.op?.value === '.') {
    return extractReferee(node.rightExpression);
  }

  return node.referee;
}

// True if node is an infix relationship expression (a op b)
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

// True if both sides of a relationship have the same tuple arity
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

// True if node is a valid index name (variable or function expression)
export function isValidIndexName (
  value?: SyntaxNode,
): value is (PrimaryExpressionNode & { expression: VariableNode }) | FunctionExpressionNode {
  return (
    (value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode)
    || value instanceof FunctionExpressionNode
  );
}

// Returns the string name of an index (variable or function expression)
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

// Destructures a call expression into callee variables and argument variables
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
  if (!fragments.every(isVariableExpression)) {
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

// Walks up the element scope chain to find a symbol by index
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

// True if node is a valid simple or complex variable name
export function isValidName (nameNode: SyntaxNode): boolean {
  return !!destructureComplexVariable(nameNode).unwrap_or(false);
}

// True if node is a unary relationship expression (op variable)
export function isUnaryRelationship (value?: SyntaxNode): value is PrefixExpressionNode {
  if (!(value instanceof PrefixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op?.value)) {
    return false;
  }

  const variables = destructureComplexVariable(value.expression).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

// True if node is a syntactically valid column type expression
export function isValidColumnType (type: SyntaxNode): boolean {
  if (
    !(
      type instanceof CallExpressionNode
      || isAccessExpression(type)
      || type instanceof PrimaryExpressionNode
      || type instanceof ArrayNode
    )
  ) {
    return false;
  }

  while (type instanceof CallExpressionNode || type instanceof ArrayNode) {
    if (type instanceof CallExpressionNode) {
      if (type.callee === undefined || type.argumentList === undefined) {
        return false;
      }

      if (!type.argumentList.elementList.every((e) => isSignedNumberExpression(e) || isQuotedStringExpression(e) || isIdentifierExpression(e))) {
        return false;
      }

      type = type.callee;
    } else if (type instanceof ArrayNode) {
      if (type.array === undefined || type.indexer === undefined) {
        return false;
      }

      if (!type.indexer.elementList.every((attribute) => !attribute.colon && !attribute.value && isSignedNumberExpression(attribute.name))) {
        return false;
      }

      type = type.array;
    }
  }

  const variables = destructureComplexVariable(type).unwrap_or(undefined);

  return variables !== undefined && variables.length > 0;
}

// True if node is a valid default value (literal, identifier, or enum ref)
export function isValidDefaultValue (value?: SyntaxNode): boolean {
  if (isQuotedStringExpression(value)) {
    return true;
  }

  if (isSignedNumberExpression(value)) {
    return true;
  }

  if (isIdentifierExpression(value) && ['true', 'false', 'null'].includes(value.expression.variable.value.toLowerCase())) {
    return true;
  }

  if (
    value instanceof PrefixExpressionNode
    && NUMERIC_LITERAL_PREFIX.includes(value.op?.value as any)
    && isSignedNumberExpression(value.expression)
  ) {
    return true;
  }

  if (value instanceof FunctionExpressionNode) {
    return true;
  }

  if (!value) return false;
  if (!isDotDelimitedIdentifier(value)) return false;
  const fragments = destructureMemberAccessExpression(value).unwrap();
  return fragments.length === 2 || fragments.length === 3;
}

// Returns the dot-joined name string for an element declaration
export function getElementNameString (element?: ElementDeclarationNode): Option<string> {
  return destructureComplexVariable(element?.name).map((ss) => ss.join('.'));
}
