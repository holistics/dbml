import {
  SyntaxNode,
  SyntaxToken,
  VariableNode,
  LiteralNode,
  FunctionExpressionNode,
  FunctionApplicationNode,
  PrimaryExpressionNode,
  ElementDeclarationNode,
  ProgramNode,
} from '@dbml/parse';
import type { SymbolInfo } from '@/stores/parserStore';

// Short human-readable label for a node/token, used both as the `name` segment
// of a readable id and for inline rendering in the AST output tab.
//
// - ProgramNode       -> absolute filepath
// - ElementDeclaration -> element's declared name
// - Variable / Literal / FunctionExpression -> their underlying token value
// - PrimaryExpression  -> inner expression's hint
// - FunctionApplication -> callee's hint
// - any SyntaxToken    -> its raw value
export function getNameHint (node: SyntaxNode | SyntaxToken): string {
  if (node instanceof SyntaxToken) return String(node.value ?? '');
  if (node instanceof ProgramNode) return node.filepath?.absolute ?? '';
  if (node instanceof VariableNode) return node.variable?.value ?? '';
  if (node instanceof LiteralNode) return node.literal?.value ?? '';
  if (node instanceof FunctionExpressionNode) return node.value?.value ?? '';
  if (node instanceof FunctionApplicationNode && node.callee) return getNameHint(node.callee);
  if (node instanceof PrimaryExpressionNode && node.expression) return getNameHint(node.expression);
  if (node instanceof ElementDeclarationNode) {
    // Show both the element keyword and the declared name so `Table users`
    // reads at a glance in the Nodes tab.
    const elementKind = node.type?.value;
    const name = node.name;
    const nameHint = name instanceof SyntaxNode ? getNameHint(name) : '';
    if (elementKind && nameHint) return `${elementKind} ${nameHint}`;
    if (elementKind) return elementKind;
    return nameHint;
  }
  return '';
}

export function getReadableId (value: SyntaxNode | SyntaxToken | SymbolInfo): string {
  if (value instanceof SyntaxToken) {
    const sl = value.startPos.line + 1, sc = value.startPos.column + 1;
    const el = value.endPos.line + 1, ec = value.endPos.column + 1;
    return `token@${value.kind}@${getNameHint(value)}@[L${sl}:C${sc}, L${el}:C${ec}]`;
  }
  if (value instanceof SyntaxNode) {
    const sl = value.startPos.line + 1, sc = value.startPos.column + 1;
    const el = value.endPos.line + 1, ec = value.endPos.column + 1;
    return `node@${value.kind}@${getNameHint(value)}@[L${sl}:C${sc}, L${el}:C${ec}]`;
  }
  if (!value.declarationPosition) return `symbol@${value.kind}@${value.name}`;
  const {
    startLine: sl, startCol: sc, endLine: el, endCol: ec,
  } = value.declarationPosition;
  return `symbol@${value.kind}@${value.name}@[L${sl}:C${sc}, L${el}:C${ec}]`;
}

// Smallest `.start` offset found anywhere inside `value`. Used to order the
// children of a SyntaxNode by source position - properties are declared in
// class order, which doesn't match how tokens and child nodes actually
// appear in the source.
export function minStart (value: unknown): number {
  if (value instanceof SyntaxNode || value instanceof SyntaxToken) return value.start;
  if (Array.isArray(value)) {
    let m = Infinity;
    for (const v of value) {
      const s = minStart(v);
      if (s < m) m = s;
    }
    return m;
  }
  return Infinity;
}

export function isSymbolInfo (v: unknown): v is SymbolInfo {
  return !!v && typeof v === 'object'
    && typeof (v as any).kind === 'string'
    && typeof (v as any).name === 'string'
    && 'members' in (v as object);
}
