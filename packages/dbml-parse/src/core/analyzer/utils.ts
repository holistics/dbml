import {
  last,
} from 'lodash-es';
import {
  isRelationshipOp, isTupleOfVariables,
} from '@/core/analyzer/validator/utils';
import {
  isAccessExpression,
  isExpressionAQuotedString,
  isExpressionAVariableNode,
} from '@/core/parser/utils';
import {
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionExpressionNode,
  InfixExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '@/core/types/nodes';
import {
  NodeSymbolIndex, isPublicSchemaIndex,
} from '@/core/types/symbol';
import {
  NodeSymbol,
} from '@/core/types/symbol/symbols';
import {
  SyntaxToken, SyntaxTokenKind,
} from '@/core/types/tokens';

export function destructureMemberAccessExpression (node?: SyntaxNode): SyntaxNode[] | undefined {
  if (!node) return undefined;

  if (!isAccessExpression(node)) {
    return [node];
  }

  const fragments = destructureMemberAccessExpression(node.leftExpression);

  if (!fragments) {
    return undefined;
  }

  fragments.push(node.rightExpression);

  return fragments;
}

export function destructureComplexVariable (node?: SyntaxNode): string[] | undefined {
  if (node === undefined) {
    return undefined;
  }

  const fragments = destructureMemberAccessExpression(node);

  if (!fragments) {
    return undefined;
  }

  const variables: string[] = [];

  for (const fragment of fragments) {
    const variable = extractVariableFromExpression(fragment);
    if (typeof variable !== 'string') {
      return undefined;
    }

    variables.push(variable);
  }

  return variables;
}

export function destructureComplexVariableTuple (
  node?: SyntaxNode,
): { variables: (PrimaryExpressionNode & { expression: VariableNode })[];
  tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[]; } | undefined {
  if (node === undefined) {
    return undefined;
  }

  const fragments = destructureMemberAccessExpression(node);

  if (!fragments || fragments.length === 0) {
    return undefined;
  }

  let tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[] = [];

  if (!isExpressionAVariableNode(last(fragments))) {
    const topFragment = fragments.pop()!;
    if (isTupleOfVariables(topFragment)) {
      tupleElements = topFragment.elementList;
    } else {
      return undefined;
    }
  }

  const variables = fragments;
  if (!variables.every(isExpressionAVariableNode)) {
    return undefined;
  }

  return {
    variables,
    tupleElements,
  };
}

export function extractVariableFromExpression (node?: SyntaxNode): string | undefined {
  if (!isExpressionAVariableNode(node)) {
    return undefined;
  }

  return node.expression.variable.value;
}

export function destructureIndexNode (node?: SyntaxNode): {
  functional: FunctionExpressionNode[];
  nonFunctional: (PrimaryExpressionNode & { expression: VariableNode })[];
} | undefined {
  if (isValidIndexName(node)) {
    return node instanceof FunctionExpressionNode
      ? {
          functional: [node],
          nonFunctional: [],
        }
      : {
          functional: [],
          nonFunctional: [node],
        };
  }

  if (node instanceof TupleExpressionNode && node.elementList.every(isValidIndexName)) {
    const functionalIndexName = node.elementList.filter(
      (e) => e instanceof FunctionExpressionNode,
    ) as FunctionExpressionNode[];
    const nonfunctionalIndexName = node.elementList.filter(isExpressionAVariableNode);

    return {
      functional: functionalIndexName,
      nonFunctional: nonfunctionalIndexName,
    };
  }

  return undefined;
}

export function extractVarNameFromPrimaryVariable (
  node?: PrimaryExpressionNode & { expression: VariableNode },
): string | undefined {
  const value = node?.expression.variable?.value;

  return value === undefined ? undefined : value;
}

export function extractQuotedStringToken (value?: SyntaxNode): string | undefined {
  if (!isExpressionAQuotedString(value)) {
    return undefined;
  }

  if (value.expression instanceof VariableNode) {
    return value.expression.variable!.value;
  }

  return value.expression.literal.value;
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
    destructureComplexVariableTuple(value.leftExpression) !== undefined
    && destructureComplexVariableTuple(value.rightExpression) !== undefined
  );
}

export function isEqualTupleOperands (value: InfixExpressionNode): value is InfixExpressionNode {
  const leftRes = destructureComplexVariableTuple(value.leftExpression);
  const rightRes = destructureComplexVariableTuple(value.rightExpression);

  if (leftRes === undefined || rightRes === undefined) {
    return false;
  }

  const {
    tupleElements: leftTuple,
  } = leftRes;
  const {
    tupleElements: rightTuple,
  } = rightRes;

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
): { variables: (PrimaryExpressionNode & { expression: VariableNode })[];
  args: (PrimaryExpressionNode & { expression: VariableNode })[]; } | undefined {
  if (!(node instanceof CallExpressionNode) || !node.callee) {
    return undefined;
  }

  // Destructure the callee (e.g., schema.table or just table)
  const fragments = destructureMemberAccessExpression(node.callee);
  if (!fragments || fragments.length === 0) {
    return undefined;
  }

  // All callee fragments must be simple variables
  if (!fragments.every(isExpressionAVariableNode)) {
    return undefined;
  }

  // Get args from argument list
  let args: (PrimaryExpressionNode & { expression: VariableNode })[] = [];
  if (isTupleOfVariables(node.argumentList)) {
    args = [...node.argumentList.elementList];
  }

  return {
    variables: fragments as (PrimaryExpressionNode & { expression: VariableNode })[],
    args,
  };
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
