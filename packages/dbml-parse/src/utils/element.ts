import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionExpressionNode,
  ListExpressionNode,
  LiteralNode,
  PrefixExpressionNode,
  PrimaryExpressionNode,
  SyntaxNode,
  VariableNode,
} from '@/core/parser/nodes';
import { isHexChar } from '@/utils/chars';
import {
  extractStringFromIdentifierStream,
  isVariableExpression,
} from '@/utils/node';
import { NUMERIC_LITERAL_PREFIX } from '@/constants';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';

// True if node represents a valid hex color literal (#rgb or #rrggbb)
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

// True if value is undefined (absent)
export function isVoid (value?: SyntaxNode): boolean {
  return value === undefined;
}

// True if the alias node is a simple single-identifier name
export function isValidAlias (
  aliasNode: SyntaxNode,
): aliasNode is PrimaryExpressionNode & { expression: VariableNode } {
  return isSimpleName(aliasNode);
}

// True if node is a primary expression with a single variable
export function isSimpleName (
  nameNode: SyntaxNode,
): nameNode is PrimaryExpressionNode & { expression: VariableNode } {
  return nameNode instanceof PrimaryExpressionNode && nameNode.expression instanceof VariableNode;
}

// True if node is a ListExpression (valid setting list)
export function isValidSettingList (
  settingListNode: SyntaxNode,
): settingListNode is ListExpressionNode {
  return settingListNode instanceof ListExpressionNode;
}

// True if element has a block body (curly braces)
export function hasComplexBody (
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { body: BlockExpressionNode; bodyColon: undefined } {
  return node.body instanceof BlockExpressionNode && !node.bodyColon;
}

// True if element has a simple colon body
export function hasSimpleBody (
  node: ElementDeclarationNode,
): node is ElementDeclarationNode & { bodyColon: SyntaxToken } {
  return !!node.bodyColon;
}

// True if node is a tilde-prefixed partial injection (~name)
export function isValidPartialInjection (
  node?: SyntaxNode,
): node is PrefixExpressionNode & { op: { value: '~' } } {
  return node instanceof PrefixExpressionNode && node.op?.value === '~' && isVariableExpression(node.expression);
}

export type SignedNumberExpression =
  (PrimaryExpressionNode & { expression: LiteralNode & { literal: { kind: SyntaxTokenKind.NUMERIC_LITERAL } } })
  | (PrefixExpressionNode & { op: '-' | '+'; expression: SignedNumberExpression });
// True if node is a numeric literal, optionally prefixed with a sign
export function isSignedNumberExpression (value?: SyntaxNode): value is SignedNumberExpression {
  if (value instanceof PrefixExpressionNode) {
    if (!NUMERIC_LITERAL_PREFIX.includes(value.op!.value)) return false;
    return isSignedNumberExpression(value.expression);
  }
  return (
    value instanceof PrimaryExpressionNode
    && value.expression instanceof LiteralNode
    && value.expression.literal?.kind === SyntaxTokenKind.NUMERIC_LITERAL
  );
}

// Groups setting list attributes by lowercased name
export function aggregateSettingList (settingList?: ListExpressionNode): Report<{ [index: string]: AttributeNode[] }> {
  const map: { [index: string]: AttributeNode[] } = {};
  const errors: CompileError[] = [];
  if (!settingList) {
    return new Report({});
  }
  settingList.elementList.forEach((attribute) => {
    if (!attribute.name) return;

    if (attribute.name instanceof PrimaryExpressionNode) {
      errors.push(new CompileError(CompileErrorCode.INVALID_SETTINGS, 'A setting name must be a stream of identifiers', attribute.name));
      return;
    }

    const name = extractStringFromIdentifierStream(attribute.name)?.toLowerCase();
    if (!name) return;

    if (map[name] === undefined) {
      map[name] = [attribute];
    } else {
      map[name].push(attribute);
    }
  });

  return new Report(map, errors);
}
