import {
  last,
} from 'lodash-es';
import type {
  ElementKind, ImportKind, SettingName,
} from '@/core/types/keywords';
import {
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  IdentiferStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  ProgramNode,
  SyntaxNode,
  TupleExpressionNode,
  UseDeclarationNode,
  UseSpecifierListNode,
  UseSpecifierNode,
  VariableNode,
  WildcardNode,
} from '@/core/types/nodes';
import {
  SyntaxToken, SyntaxTokenKind,
} from '@/core/types/tokens';
import {
  isRelationshipOp,
  isTupleOfVariables,
} from './validate';

export function extractVariableNode (value?: unknown): SyntaxToken | undefined {
  if (isExpressionAVariableNode(value)) {
    return value.expression.variable;
  }
  return undefined;
}

export function isExpressionAQuotedString (value?: unknown): value is PrimaryExpressionNode
  & (
    | { expression: VariableNode & { variable: SyntaxToken & { kind: SyntaxTokenKind.QUOTED_STRING } } }
    | {
      expression: LiteralNode & {
        literal: SyntaxToken & { kind: SyntaxTokenKind.STRING_LITERAL };
      };
    }
  ) {
  return (
    value instanceof PrimaryExpressionNode
    && (
      (
        value.expression instanceof VariableNode
        && value.expression.variable instanceof SyntaxToken
        && value.expression.variable.kind === SyntaxTokenKind.QUOTED_STRING
      )
      || (
        value.expression instanceof LiteralNode
        && value.expression.literal?.kind === SyntaxTokenKind.STRING_LITERAL
      )
    )
  );
}

export function isExpressionAVariableNode (
  value?: unknown,
): value is PrimaryExpressionNode & { expression: VariableNode & { variable: SyntaxToken } } {
  return (
    value instanceof PrimaryExpressionNode
    && value.expression instanceof VariableNode
    && value.expression.variable instanceof SyntaxToken
  );
}

export function isExpressionAnIdentifierNode (value?: unknown): value is PrimaryExpressionNode & {
  expression: VariableNode & { variable: { kind: SyntaxTokenKind.IDENTIFIER } };
} {
  return (
    value instanceof PrimaryExpressionNode
    && value.expression instanceof VariableNode
    && value.expression.variable?.kind === SyntaxTokenKind.IDENTIFIER
  );
}

type AccessExpression = InfixExpressionNode & {
  leftExpression: SyntaxNode;
  rightExpression: SyntaxNode;
  op: SyntaxToken & { value: '.' };
};

type DotDelimitedIdentifier = PrimaryExpressionNode | (AccessExpression & {
  leftExpression: AccessExpression | PrimaryExpressionNode;
  rightExpression: PrimaryExpressionNode;
});

export function isAccessExpression (node?: SyntaxNode): node is AccessExpression {
  return (
    node instanceof InfixExpressionNode
    && node.leftExpression instanceof SyntaxNode
    && node.rightExpression instanceof SyntaxNode
    && node.op?.value === '.'
  );
}

export function isDotDelimitedIdentifier (node?: SyntaxNode): node is DotDelimitedIdentifier {
  if (isExpressionAVariableNode(node)) return true;
  return isAccessExpression(node) && isExpressionAVariableNode(node.rightExpression) && isDotDelimitedIdentifier(node.leftExpression);
}

export function extractStringFromIdentifierStream (stream?: IdentiferStreamNode): string | undefined {
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

export function isAsKeyword (
  token?: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER;
  value: 'as'; } {
  return token?.kind === SyntaxTokenKind.IDENTIFIER && token.value.toLowerCase() === 'as';
}

// Check if a token is the `use` keyword (case-insensitive)
export function isUseKeyword (
  token?: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER } {
  return token?.kind === SyntaxTokenKind.IDENTIFIER && token.value.toLowerCase() === 'use';
}

// Check if a token is the `from` keyword (case-insensitive)
export function isFromKeyword (
  token?: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER } {
  return token?.kind === SyntaxTokenKind.IDENTIFIER && token.value.toLowerCase() === 'from';
}

// Check if a token is the `reuse` keyword (case-insensitive)
export function isReuseKeyword (
  token?: SyntaxToken,
): token is SyntaxToken & { kind: SyntaxTokenKind.IDENTIFIER } {
  return token?.kind === SyntaxTokenKind.IDENTIFIER && token.value.toLowerCase() === 'reuse';
}

export function getBody (node?: ElementDeclarationNode): (FunctionApplicationNode | ElementDeclarationNode)[] {
  if (!node?.body) return [];
  return node.body instanceof BlockExpressionNode
    ? node.body.body
    : [
        node.body,
      ];
}

// Return whether `node` is an ElementDeclarationNode of kind `kind`
export function isElementNode (node: SyntaxNode | undefined, kind: ElementKind): node is ElementDeclarationNode {
  return node instanceof ElementDeclarationNode && node.isKind(kind);
}

// Return whether `node` is a UseDeclarationNode
export function isUseDeclaration (node: SyntaxNode): node is UseDeclarationNode {
  return node instanceof UseDeclarationNode;
}

// Return whether `node` is an UseDeclarationNode with import kind `kind`
export function isUseSpecifier (node: SyntaxNode, kind?: ImportKind): node is UseSpecifierNode {
  return node instanceof UseSpecifierNode && (kind === undefined || node.isKind(kind));
}

// Return whether `node` is a WilcardNode inside use all import
export function isWildcardSpecifier (node: SyntaxNode): node is WildcardNode {
  return node instanceof WildcardNode && !!node.parentOfKind(UseDeclarationNode) && !node.parentOfKind(UseSpecifierListNode); // inside UseDeclarationNode but outside UseSepcifierListNode
}

// Return whether `node` is a ProgramNode
export function isProgramNode (node: SyntaxNode | undefined): node is ProgramNode {
  return node instanceof ProgramNode;
}

// Return whether `node` is a field of some element
export function isElementFieldNode (node: SyntaxNode | undefined, kind: ElementKind): node is FunctionApplicationNode {
  return node instanceof FunctionApplicationNode
    && node.parent instanceof ElementDeclarationNode
    && node.parent.isKind(kind);
}

// Return whether `node` is within some element of a given kind
export function isInsideElementBody (node: SyntaxNode, kind: ElementKind): boolean {
  const parent = node.parent;
  return parent instanceof ElementDeclarationNode
    && parent.isKind(kind)
    && !!parent.body
    && parent.body.strictlyContains(node);
}

// Return whether `node` is within the n-th arg of a field
// `callee` -> 0th arg
// `args[0]` -> 1th arg
// `args[1]` -> 2nd arg
// ...
export function isWithinNthArgOfField (node: SyntaxNode, nth: number): boolean {
  const parentField = node.parentOfKind(FunctionApplicationNode);
  if (!parentField) {
    return false;
  }
  if (nth < 0) return false;
  if (nth === 0) {
    if (!parentField.callee) return false;
    return parentField.callee.containsEq(node);
  }
  const arg = parentField.args[nth - 1];
  if (!arg) return false;
  return arg.containsEq(node);
}

// Return whether `node` is within a setting list
export function isInsideSettingList (node: SyntaxNode): boolean {
  const parentField = node.parentOfKind(ListExpressionNode);
  return !!parentField;
}

export function isInsideSettingValue (node: SyntaxNode, settingName: SettingName): boolean {
  const attributeNode = node.parentOfKind(AttributeNode);
  if (!attributeNode) return false;
  const name = attributeNode.name instanceof PrimaryExpressionNode ? extractVariableFromExpression(attributeNode.name) : extractStringFromIdentifierStream(attributeNode.name);
  if (name?.toLowerCase() !== settingName) {
    return false;
  }
  return !!attributeNode.value?.containsEq(node);
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

function isValidRefEndpoint (node?: SyntaxNode): boolean {
  if (!node) return false;
  // Simple dotted chain: a.b.c
  if (destructureComplexVariableTuple(node)) return true;
  // Standalone tuple of dotted chains: (a.b, c.d)
  if (node instanceof TupleExpressionNode) {
    return node.elementList.length > 0 && node.elementList.every((e) => destructureComplexVariable(e) !== undefined);
  }
  return false;
}

export function isBinaryRelationship (value?: SyntaxNode): value is InfixExpressionNode {
  if (!(value instanceof InfixExpressionNode)) return false;
  if (!isRelationshipOp(value.op?.value)) return false;

  return isValidRefEndpoint(value.leftExpression) && isValidRefEndpoint(value.rightExpression);
}

function countEndpointColumns (node?: SyntaxNode): number {
  if (!node) return 0;
  const tuple = destructureComplexVariableTuple(node);
  if (tuple) return Math.max(1, tuple.tupleElements.length);
  if (node instanceof TupleExpressionNode) return node.elementList.length;
  return 0;
}

export function isEqualTupleOperands (value: InfixExpressionNode): boolean {
  return countEndpointColumns(value.leftExpression) === countEndpointColumns(value.rightExpression);
}

export function isValidIndexName (
  value?: SyntaxNode,
): value is (PrimaryExpressionNode & { expression: VariableNode }) | FunctionExpressionNode {
  return (
    (value instanceof PrimaryExpressionNode && value.expression instanceof VariableNode)
    || value instanceof FunctionExpressionNode
  );
}

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

export function isWildcardExpression (node: SyntaxNode | undefined): node is WildcardNode {
  return node instanceof WildcardNode;
}

// Returns true if `node` is the rightmost (terminal) fragment of an access expression chain.
// A node is terminal when its containing access expression is NOT itself the left-hand side
// of a further access expression (e.g. `users` in `public.users` or `auth.public.users`).
// Precondition: node must be the right child of an access expression (isAccessExpression(node.parentNode)).
export function isTerminalAccessFragment (node: SyntaxNode): boolean {
  const currentAccess = node.parentNode as InfixExpressionNode;
  return !(isAccessExpression(currentAccess.parentNode) && (currentAccess.parentNode as InfixExpressionNode).leftExpression === currentAccess);
}

export function isInvalidToken (token?: SyntaxToken): boolean {
  return !!token?.isInvalid;
}
