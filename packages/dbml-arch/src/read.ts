import {
  AttributeNode,
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  IdentifierStreamNode,
  InfixExpressionNode,
  ListExpressionNode,
  LiteralNode,
  PrimaryExpressionNode,
  VariableNode,
} from '@dbml/parse';
import { SyntaxTokenKind } from '@dbml/parse';
import type { SyntaxNode } from '@dbml/parse';
import type { Located, SettingValue, Settings } from './model.js';

/**
 * READING THE TREE DBML'S PARSER BUILT.
 *
 * These are the only place this dialect touches the shape of a syntax node, and they are kept
 * small on purpose. Everything above them speaks in names, settings and ranges; if DBML's AST
 * moves, this file moves and nothing else does.
 *
 * They are written here rather than imported from `@dbml/parse` because the equivalents there
 * are internal. Thirty lines of readers cost less than widening somebody else's public API for
 * a dialect that is still proving itself.
 */

export const elementKindWord = (node: ElementDeclarationNode): string | undefined => node.type?.value;

/** `Server api1` gives `api1`; a quoted or dotted name gives its text, which is good enough here */
export function nameOf (node?: SyntaxNode): string | undefined {
  if (!node) return undefined;
  if (node instanceof PrimaryExpressionNode) {
    if (node.expression instanceof VariableNode) return node.expression.variable?.value;
    if (node.expression instanceof LiteralNode) return String(node.expression.literal?.value);
  }
  if (node instanceof IdentifierStreamNode) {
    return node.identifiers?.map((t) => t.value).join(' ');
  }
  return undefined;
}

/**
 * A NUMBER IS A NUMBER, AND A QUOTED STRING IS A STRING, even when it looks like one.
 *
 * This used to call `Number()` on any literal it found, which meant `engine_version: '16.3'`
 * arrived as the number 16.3 and `'16.30'` arrived as 16.3 as well. For a drawing that is
 * harmless; for anything generating configuration out of the model it is not, because a
 * version, a zero-padded zone and an account id are all strings that happen to be digits.
 *
 * The lexer already tells them apart: a quoted value is a STRING_LITERAL and a bare one is a
 * NUMERIC_LITERAL. Reading the token's kind costs nothing and is the only way to keep the
 * author's quotes meaning what they say.
 */
export function numberOf (node?: SyntaxNode): number | null {
  if (!(node instanceof PrimaryExpressionNode) || !(node.expression instanceof LiteralNode)) {
    return null;
  }
  const token = node.expression.literal;
  if (token?.kind !== SyntaxTokenKind.NUMERIC_LITERAL) return null;
  const value = Number(token.value);
  return Number.isFinite(value) ? value : null;
}

/**
 * `[name: 'API1', style: dashed, inactive]`.
 *
 * A setting with no value is `true`, the way `[pk]` is in DBML: a flag is a setting whose name
 * carries the whole meaning, and making the author write `[inactive: true]` buys nothing.
 */
export function settingsOf (list?: ListExpressionNode): Settings {
  const out: Settings = {};
  for (const attribute of list?.elementList ?? []) {
    if (!(attribute instanceof AttributeNode)) continue;
    const key = nameOf(attribute.name)?.toLowerCase();
    if (!key) continue;
    out[key] = attribute.value === undefined ? true : (valueOf(attribute.value) ?? true);
  }
  return out;
}

function valueOf (node: SyntaxNode): SettingValue | undefined {
  const num = numberOf(node);
  if (num !== null) return num;
  const text = nameOf(node);
  if (text === undefined) return undefined;
  if (text === 'true') return true;
  if (text === 'false') return false;
  return text;
}

/** the statements inside `{ ... }`, or the single expression after `:` */
export function bodyOf (node: ElementDeclarationNode): SyntaxNode[] {
  if (!node.body) return [];
  return node.body instanceof BlockExpressionNode ? [...node.body.body] : [node.body];
}

/** a body row is `callee arg1 arg2 [settings]`, the same shape a DBML column has */
export interface Row {
  callee: SyntaxNode | undefined;
  args: SyntaxNode[];
  settings: ListExpressionNode | undefined;
  node: SyntaxNode;
}

export function rowOf (node: SyntaxNode): Row | undefined {
  if (!(node instanceof FunctionApplicationNode)) return undefined;
  const args = [...(node.args ?? [])];
  const last = args[args.length - 1];
  const settings = last instanceof ListExpressionNode ? (args.pop() as ListExpressionNode) : undefined;
  return { callee: node.callee, args, settings, node };
}

/** `api1 > mongo_rs`, `a - b`, `a <> b.web`: operator in the middle, endpoints either side */
export interface Infix {
  left: SyntaxNode;
  op: string;
  right: SyntaxNode;
}

export function infixOf (node?: SyntaxNode): Infix | undefined {
  if (!(node instanceof InfixExpressionNode)) return undefined;
  const op = node.op?.value;
  if (!op || !node.leftExpression || !node.rightExpression) return undefined;
  return { left: node.leftExpression, op, right: node.rightExpression };
}

/**
 * `mongo_rs.web` splits into a target and a port.
 *
 * DBML spells an access expression as an infix `.`, so the same reader that finds a link's
 * operator finds this one. A name with no dot is a target with no port.
 */
export function targetOf (node: SyntaxNode): { id: string | undefined; port: string | null } {
  const access = infixOf(node);
  if (access && access.op === '.') {
    return { id: nameOf(access.left), port: nameOf(access.right) ?? null };
  }
  return { id: nameOf(node), port: null };
}

export const locate = (node: SyntaxNode, file: string): Located => ({
  file,
  range: {
    start: { line: node.startPos.line + 1, column: node.startPos.column + 1, offset: node.startPos.offset },
    end: { line: node.endPos.line + 1, column: node.endPos.column + 1, offset: node.endPos.offset },
  },
});

export const isElement = (node: SyntaxNode): node is ElementDeclarationNode => node instanceof ElementDeclarationNode;
