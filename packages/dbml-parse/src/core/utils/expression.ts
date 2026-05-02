import {
  last,
} from 'lodash-es';
import {
  isAccessExpression,
  isExpressionAQuotedString,
  isExpressionAVariableNode,
  isTupleOfVariables,
  isValidIndexName,
} from '@/core/utils/validate';
import {
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  IdentifierStreamNode,
  LiteralNode,
  PrimaryExpressionNode,
  SyntaxNode,
  TupleExpressionNode,
  VariableNode,
} from '@/core/types/nodes';
import {
  SyntaxToken, SyntaxTokenKind,
} from '@/core/types/tokens';

export function extractVariableNode (value?: unknown): SyntaxToken | undefined {
  if (isExpressionAVariableNode(value)) {
    return value.expression.variable;
  }
  return undefined;
}

export function extractStringFromIdentifierStream (stream?: IdentifierStreamNode): string | undefined {
  if (stream === undefined) return undefined;
  const name = stream.identifiers.map((identifier) => identifier.value).join(' ');
  if (name === '') return undefined;
  return name;
}

export function getElementNameString (element?: SyntaxNode): string | undefined {
  if (!(element instanceof ElementDeclarationNode)) return undefined;
  const ss = destructureComplexVariable(element?.name);
  return ss !== undefined ? ss.join('.') : undefined;
}

export function isTupleEmpty (tuple: TupleExpressionNode): boolean {
  return tuple.elementList.length === 0;
}

export function getBody (node?: ElementDeclarationNode): (FunctionApplicationNode | ElementDeclarationNode)[] {
  if (!node?.body) return [];
  return node.body instanceof BlockExpressionNode
    ? node.body.body
    : [
        node.body,
      ];
}

export function destructureMemberAccessExpression (node?: SyntaxNode): SyntaxNode[] | undefined {
  if (!node) return undefined;

  if (!isAccessExpression(node)) {
    return [
      node,
    ];
  }

  const fragments = destructureMemberAccessExpression(node.leftExpression);
  if (!fragments) return undefined;

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
): {
  variables: (PrimaryExpressionNode & { expression: VariableNode })[];
  tupleElements: (PrimaryExpressionNode & { expression: VariableNode })[];
} | undefined {
  if (node === undefined) return undefined;

  const fragments = destructureMemberAccessExpression(node);
  if (!fragments || fragments.length === 0) return undefined;

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
  if (!variables.every(isExpressionAVariableNode)) return undefined;

  return {
    variables,
    tupleElements,
  };
}

export function destructureIndexNode (node?: SyntaxNode): {
  functional: FunctionExpressionNode[];
  nonFunctional: (PrimaryExpressionNode & { expression: VariableNode })[];
} | undefined {
  if (isValidIndexName(node)) {
    return node instanceof FunctionExpressionNode
      ? {
          functional: [
            node,
          ],
          nonFunctional: [],
        }
      : {
          functional: [],
          nonFunctional: [
            node,
          ],
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

export function extractQuotedStringToken (value?: SyntaxNode): string | undefined {
  if (!isExpressionAQuotedString(value)) return undefined;

  if (value?.expression instanceof VariableNode) {
    return value?.expression?.variable?.value;
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

// Destructure a call expression like `schema.table(col1, col2)` or `table(col1, col2)`.
// Returns the callee variables (schema, table) and the args (col1, col2).
//   schema.table(col1, col2) => { variables: [schema, table], args: [col1, col2] }
//   table(col1, col2)        => { variables: [table], args: [col1, col2] }
//   table()                  => { variables: [table], args: [] }
export function destructureCallExpression (
  node?: SyntaxNode,
): {
  variables: (PrimaryExpressionNode & { expression: VariableNode })[];
  args: (PrimaryExpressionNode & { expression: VariableNode })[];
} | undefined {
  if (!(node instanceof CallExpressionNode) || !node.callee) return undefined;

  const fragments = destructureMemberAccessExpression(node.callee);
  if (!fragments || fragments.length === 0) return undefined;
  if (!fragments.every(isExpressionAVariableNode)) return undefined;

  let args: (PrimaryExpressionNode & { expression: VariableNode })[] = [];
  if (isTupleOfVariables(node.argumentList)) {
    args = [
      ...node.argumentList.elementList,
    ];
  }

  return {
    variables: fragments as (PrimaryExpressionNode & { expression: VariableNode })[],
    args,
  };
}

export function extractVariableFromExpression (node?: SyntaxNode): string | undefined {
  if (!isExpressionAVariableNode(node)) {
    return undefined;
  }

  return node.expression.variable.value;
}

export function extractVarNameFromPrimaryVariable (
  node?: PrimaryExpressionNode & { expression: VariableNode },
): string | undefined {
  const value = node?.expression.variable?.value;

  return value === undefined ? undefined : value;
}
