import {
  NUMERIC_LITERAL_PREFIX,
} from '@/constants';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ArrayNode,
  AttributeNode,
  BlockExpressionNode,
  CallExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  FunctionExpressionNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  PrefixExpressionNode,
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
import Report from '@/core/types/report';
import {
  SyntaxToken, SyntaxTokenKind,
} from '@/core/types/tokens';
import {
  ElementKind,
  SettingName,
} from '../types/keywords';
import {
  ImportKind,
} from '../types/symbol';
import {
  isHexChar,
} from './chars';
import {
  destructureComplexVariable, destructureComplexVariableTuple, destructureMemberAccessExpression,
  extractStringFromIdentifierStream,
  extractVariableFromExpression,
} from './expression';

// Is the name valid (either simple or complex)
export function isValidName (nameNode: SyntaxNode): boolean {
  const res = destructureComplexVariable(nameNode);
  return res !== undefined && res.length > 0;
}

// Is the alias valid (only simple name is allowed)
export function isValidAlias (
  aliasNode: SyntaxNode,
): aliasNode is PrimaryExpressionNode & { expression: VariableNode } {
  return isSimpleName(aliasNode);
}

// Is the name valid and simple
export function isSimpleName (
  nameNode: SyntaxNode,
): nameNode is PrimaryExpressionNode & { expression: VariableNode } {
  return nameNode instanceof PrimaryExpressionNode && nameNode.expression instanceof VariableNode;
}

// Is the argument a ListExpression
export function isValidSettingList (
  settingListNode: SyntaxNode,
): settingListNode is ListExpressionNode {
  return settingListNode instanceof ListExpressionNode;
}

// Does the element has complex body
export function hasComplexBody (
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { body: BlockExpressionNode;
  bodyColon: undefined; } {
  return node.body instanceof BlockExpressionNode && !node.bodyColon;
}

// Does the element has simple body
export function hasSimpleBody (
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { bodyColon: SyntaxToken } {
  return !!node.bodyColon;
}

export function isValidPartialInjection (
  node?: SyntaxNode,
): node is PrefixExpressionNode & { op: { value: '~' } } {
  return node instanceof PrefixExpressionNode && node.op?.value === '~' && isExpressionAVariableNode(node.expression);
}

export function isRelationshipOp (op?: string): boolean {
  return op === '-' || op === '<>' || op === '>' || op === '<';
}

export function isValidColor (value?: SyntaxNode): boolean {
  if (
    !(value instanceof PrimaryExpressionNode)
    || !(value.expression instanceof LiteralNode)
    || !(value.expression.literal?.kind === SyntaxTokenKind.COLOR_LITERAL)
  ) {
    return false;
  }

  const color = value.expression.literal.value;

  // e.g. #fff or #0abcde
  if (color.length !== 4 && color.length !== 7) {
    return false;
  }

  if (color[0] !== '#') {
    return false;
  }

  for (let i = 1; i < color.length; i += 1) {
    if (!isHexChar(color[i])) {
      return false;
    }
  }

  return true;
}

// Is the `value` a valid value for a column's `default` setting
// It's a valid only if it's a literal or a complex variable (potentially an enum member)
export function isValidDefaultValue (value?: SyntaxNode): boolean {
  if (isExpressionAQuotedString(value)) {
    return true;
  }

  if (isExpressionASignedNumberExpression(value)) {
    return true;
  }

  if (isExpressionAnIdentifierNode(value) && [
    'true',
    'false',
    'null',
  ].includes(value.expression.variable.value.toLowerCase())) {
    return true;
  }

  if (
    value instanceof PrefixExpressionNode
    && NUMERIC_LITERAL_PREFIX.includes(value.op?.value as any)
    && isExpressionASignedNumberExpression(value.expression)
  ) {
    return true;
  }

  if (value instanceof FunctionExpressionNode) {
    return true;
  }

  if (!value) return false;
  if (!isDotDelimitedIdentifier(value)) return false;
  const fragments = destructureMemberAccessExpression(value)!;
  return fragments.length === 2 || fragments.length === 3;
}

export type SignedNumberExpression =
  (PrimaryExpressionNode & { expression: LiteralNode & { literal: { kind: SyntaxTokenKind.NUMERIC_LITERAL } } })
  | (PrefixExpressionNode & { op: '-' | '+';
    expression: SignedNumberExpression; });
export function isExpressionASignedNumberExpression (value?: SyntaxNode): value is SignedNumberExpression {
  if (value instanceof PrefixExpressionNode) {
    if (!NUMERIC_LITERAL_PREFIX.includes(value.op!.value)) return false;
    return isExpressionASignedNumberExpression(value.expression);
  }
  return (
    value instanceof PrimaryExpressionNode
    && value.expression instanceof LiteralNode
    && value.expression.literal?.kind === SyntaxTokenKind.NUMERIC_LITERAL
  );
}

export function isUnaryRelationship (value?: SyntaxNode): value is PrefixExpressionNode {
  if (!(value instanceof PrefixExpressionNode)) {
    return false;
  }

  if (!isRelationshipOp(value.op?.value)) {
    return false;
  }

  const variables = destructureComplexVariable(value.expression);

  return variables !== undefined && variables.length > 0;
}

export function isTupleOfVariables (value?: SyntaxNode): value is TupleExpressionNode & {
  elementList: (PrimaryExpressionNode & { expression: VariableNode })[];
} {
  return value instanceof TupleExpressionNode && value.elementList.every(isExpressionAVariableNode);
}

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

      if (!type.argumentList.elementList.every((e) => isExpressionASignedNumberExpression(e) || isExpressionAQuotedString(e) || isExpressionAnIdentifierNode(e))) {
        return false;
      }

      type = type.callee;
    } else if (type instanceof ArrayNode) {
      if (type.array === undefined || type.indexer === undefined) {
        return false;
      }

      if (!type.indexer.elementList.every((attribute) => !attribute.colon && !attribute.value && isExpressionASignedNumberExpression(attribute.name))) {
        return false;
      }

      type = type.array;
    }
  }

  const variables = destructureComplexVariable(type);

  return variables !== undefined && variables.length > 0;
}

export type Settings = Record<SettingName | string, AttributeNode[]>;

export function aggregateSettingList (settingList?: ListExpressionNode): Report<Settings> {
  const map: Settings = {};
  const errors: CompileError[] = [];

  if (!settingList) {
    return new Report(map);
  }

  settingList.elementList.forEach((attribute) => {
    if (!attribute.name) return;

    if (attribute.name instanceof PrimaryExpressionNode) {
      errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'A setting name must be a stream of identifiers', attribute.name));
      return;
    }

    const name = extractStringFromIdentifierStream(attribute.name)?.toLowerCase();
    if (!name) return;

    const existing = map[name];

    if (existing) {
      existing.push(attribute);
    } else {
      map[name] = [
        attribute,
      ];
    }
  });

  return new Report(map, errors);
}

// Return true if an expression node is a primary expression
// with a nested quoted string (", ' or ''')
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

// Return true if an expression node is a primary expression
// with a variable node (identifier or a double-quoted string)
export function isExpressionAVariableNode (
  value?: unknown,
): value is PrimaryExpressionNode & { expression: VariableNode & { variable: SyntaxToken } } {
  return (
    value instanceof PrimaryExpressionNode
    && value.expression instanceof VariableNode
    && value.expression.variable instanceof SyntaxToken
  );
}

// Return true if an expression node is a wildcard (*)
export function isWildcardExpression (node: SyntaxNode | undefined): boolean {
  if (!node) return false;
  return node instanceof WildcardNode;
}

// Return true if an expression node is a primary expression
// with an identifier-like variable node
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
  rightExpression: AccessExpression | PrimaryExpressionNode;
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
export function isElementFieldNode (node: SyntaxNode | undefined, ...kinds: ElementKind[]): node is FunctionApplicationNode {
  return node instanceof FunctionApplicationNode
    && node.parent instanceof ElementDeclarationNode
    && node.parent.isKind(...kinds);
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

export function isEqualTupleOperands (value: InfixExpressionNode): boolean {
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

// Returns true if `node` is the rightmost (terminal) fragment of an access expression chain.
// A node is terminal when its containing access expression is NOT itself the left-hand side
// of a further access expression (e.g. `users` in `public.users` or `auth.public.users`).
export function isTerminalAccessFragment (node: SyntaxNode): boolean {
  const currentAccess = node.parentNode;
  if (!isAccessExpression(currentAccess)) return false;
  if (currentAccess.rightExpression !== node) return false;
  return !(isAccessExpression(currentAccess.parentNode) && (currentAccess.parentNode as InfixExpressionNode).leftExpression === currentAccess);
}
