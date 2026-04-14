// Converts SyntaxToken, SyntaxNode, and SymbolInfo into plain JSON-serializable
// objects. Structure mirrors toSnapshot in packages/dbml-parse/__tests__/utils/testHelpers.ts
// but runs without a Compiler — pass source string optionally for snippets.

import { SyntaxToken, SyntaxNode } from '@dbml/parse';
import type { SymbolInfo, DeclPos } from '@/stores/parserStore';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface SerializedPosition {
  line: number;
  column: number;
}

export interface SerializedToken {
  context: {
    id: string;
    snippet?: string;
  };
  value: string;
  leadingTrivia: string;
  trailingTrivia: string;
  isInvalid?: true;
}

export interface SerializedNode {
  context: {
    id: string;
    snippet?: string;
  };
  start: SerializedPosition;
  end: SerializedPosition;
  children: Record<string, unknown>;
}

export interface SerializedSymbol {
  context: {
    id: string;
    declPos?: DeclPos;
  };
  members?: SerializedSymbol[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function tokenReadableId (token: SyntaxToken): string {
  const sl = token.startPos.line + 1, sc = token.startPos.column + 1;
  const el = token.endPos.line + 1, ec = token.endPos.column + 1;
  return `token@${token.kind}@${token.value ?? ''}@[L${sl}:C${sc}, L${el}:C${ec}]`;
}

function nodeReadableId (node: SyntaxNode): string {
  const sl = node.startPos.line + 1, sc = node.startPos.column + 1;
  const el = node.endPos.line + 1, ec = node.endPos.column + 1;
  return `node@${node.kind}@${nodeNameHint(node)}@[L${sl}:C${sc}, L${el}:C${ec}]`;
}

function symbolReadableId (sym: SymbolInfo): string {
  if (!sym.declPos) return `symbol@${sym.kind}@${sym.name}`;
  const { startLine: sl, startCol: sc, endLine: el, endCol: ec } = sym.declPos;
  return `symbol@${sym.kind}@${sym.name}@[L${sl}:C${sc}, L${el}:C${ec}]`;
}

// Duck-typed name hint — mirrors getNameHint in testHelpers.ts without subclass imports.
function nodeNameHint (node: SyntaxNode): string {
  const raw = node as unknown as Record<string, unknown>;
  if (raw.variable instanceof Object && typeof (raw.variable as any).value === 'string') return (raw.variable as any).value;
  if (raw.literal instanceof Object && typeof (raw.literal as any).value === 'string') return (raw.literal as any).value;
  if (raw.value instanceof Object && typeof (raw.value as any).value === 'string') return (raw.value as any).value;
  if (raw.name instanceof Object && typeof (raw.name as any).kind === 'string') return nodeNameHint(raw.name as SyntaxNode);
  if (typeof raw.value === 'string') return raw.value;
  return '';
}

function extractSnippet (node: SyntaxNode | SyntaxToken, source?: string): string | undefined {
  if (!source) return undefined;
  const text = source.slice(node.start, node.end);
  return text.length <= 20 ? text : `${text.slice(0, 10)}...${text.slice(-10)}`;
}

// Fields stripped from SyntaxNode when building children
const NODE_SKIP = new Set([
  'id', 'parent', 'parentNode', 'kind',
  'startPos', 'endPos', 'start', 'end',
  'filepath', 'fullStart', 'fullEnd',
  'source', // ProgramNode.source — full source text
]);

// ---------------------------------------------------------------------------
// Serializers
// ---------------------------------------------------------------------------

export function serializeToken (token: SyntaxToken, source?: string): SerializedToken {
  const result: SerializedToken = {
    context: {
      id: tokenReadableId(token),
      snippet: extractSnippet(token, source),
    },
    value: token.value,
    leadingTrivia: token.leadingTrivia.map((t) => t.value).join(''),
    trailingTrivia: token.trailingTrivia.map((t) => t.value).join(''),
  };
  if (!result.context.snippet) delete result.context.snippet;
  if (token.isInvalid) result.isInvalid = true;
  return result;
}

export function serializeNode (node: SyntaxNode, source?: string): SerializedNode {
  const raw = node as unknown as Record<string, unknown>;
  const children: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (NODE_SKIP.has(key) || val === undefined) continue;
    children[key] = serializeValue(val, source);
  }
  const result: SerializedNode = {
    context: {
      id: nodeReadableId(node),
      snippet: extractSnippet(node, source),
    },
    start: { line: node.startPos.line + 1, column: node.startPos.column + 1 },
    end: { line: node.endPos.line + 1, column: node.endPos.column + 1 },
    children,
  };
  if (!result.context.snippet) delete result.context.snippet;
  return result;
}

export function serializeSymbol (sym: SymbolInfo): SerializedSymbol {
  const result: SerializedSymbol = {
    context: {
      id: symbolReadableId(sym),
      declPos: sym.declPos ?? undefined,
    },
  };
  if (!result.context.declPos) delete result.context.declPos;
  if (sym.members.length > 0) result.members = sym.members.map(serializeSymbol);
  return result;
}

// ---------------------------------------------------------------------------
// Internal recursive value serializer
// ---------------------------------------------------------------------------

function serializeValue (val: unknown, source?: string): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map((v) => serializeValue(v, source));

  if (val instanceof SyntaxNode) return serializeNode(val, source);
  if (val instanceof SyntaxToken) return serializeToken(val, source);

  const obj = val as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (NODE_SKIP.has(k) || v === undefined) continue;
    result[k] = serializeValue(v, source);
  }
  return result;
}
