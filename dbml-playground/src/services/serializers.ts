/**
 * Serializers for DBML parser output types.
 *
 * Converts SyntaxToken, SyntaxNode, and SymbolInfo into plain JSON-serializable
 * objects for display and export. Structure mirrors the toSnapshot helpers in
 * packages/dbml-parse/__tests__/utils/testHelpers.ts.
 *
 * Unlike toSnapshot, these run without a Compiler: no snippet extraction requires
 * a source string passed optionally, and symbol members come from SymbolInfo
 * (already built by parserStore) rather than compiler.symbolMembers().
 */

import type { SyntaxToken, SyntaxNode, ProgramNode } from '@dbml/parse';
import type { SymbolInfo, DeclPos } from '@/stores/parserStore';

// ---------------------------------------------------------------------------
// Shared output types
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

/** Readable id: "token@<kind>@<value>@[L<sl>:C<sc>, L<el>:C<ec>]" */
function tokenReadableId (token: SyntaxToken): string {
  const sl = token.startPos.line + 1;
  const sc = token.startPos.column + 1;
  const el = token.endPos.line + 1;
  const ec = token.endPos.column + 1;
  return `token@${token.kind}@${token.value ?? ''}@[L${sl}:C${sc}, L${el}:C${ec}]`;
}

/** Readable id: "node@<kind>@<nameHint>@[L<sl>:C<sc>, L<el>:C<ec>]" */
function nodeReadableId (node: SyntaxNode): string {
  const sl = node.startPos.line + 1;
  const sc = node.startPos.column + 1;
  const el = node.endPos.line + 1;
  const ec = node.endPos.column + 1;
  const hint = nodeNameHint(node);
  return `node@${node.kind}@${hint}@[L${sl}:C${sc}, L${el}:C${ec}]`;
}

/** Readable id: "symbol@<kind>@<name>@[L<sl>:C<sc>, L<el>:C<ec>]" */
function symbolReadableId (sym: SymbolInfo): string {
  if (sym.declPos) {
    const { startLine: sl, startCol: sc, endLine: el, endCol: ec } = sym.declPos;
    return `symbol@${sym.kind}@${sym.name}@[L${sl}:C${sc}, L${el}:C${ec}]`;
  }
  return `symbol@${sym.kind}@${sym.name}`;
}

/**
 * Extract a short name hint from a node via duck-typing.
 * Mirrors getNameHint in testHelpers.ts without requiring the subclass imports.
 */
function nodeNameHint (node: SyntaxNode): string {
  const raw = node as unknown as Record<string, unknown>;
  // VariableNode / LiteralNode / FunctionExpressionNode → .variable.value / .literal.value / .value.value
  if (raw.variable instanceof Object && typeof (raw.variable as any).value === 'string') {
    return (raw.variable as any).value as string;
  }
  if (raw.literal instanceof Object && typeof (raw.literal as any).value === 'string') {
    return (raw.literal as any).value as string;
  }
  if (raw.value instanceof Object && typeof (raw.value as any).value === 'string') {
    return (raw.value as any).value as string;
  }
  // ElementDeclarationNode — name is a sub-node; recurse one level
  if (raw.name instanceof Object && typeof (raw.name as any).kind === 'string') {
    return nodeNameHint(raw.name as SyntaxNode);
  }
  // SyntaxToken value inline (e.g. some token-wrapping nodes)
  if (typeof raw.value === 'string') return raw.value;
  return '';
}

/**
 * Extract a short code snippet from source text using start/end offsets.
 * Returns undefined when source is not provided.
 */
function extractSnippet (node: SyntaxNode | SyntaxToken, source?: string): string | undefined {
  if (!source) return undefined;
  const text = source.slice(node.start, node.end);
  if (text.length <= 20) return text;
  return `${text.slice(0, 10)}...${text.slice(-10)}`;
}

// Internal fields stripped from SyntaxNode children
const NODE_SKIP = new Set([
  'id', 'parent', 'parentNode', 'kind',
  'startPos', 'endPos', 'start', 'end',
  'filepath', 'fullStart', 'fullEnd',
  'source', // ProgramNode.source — full source text, bloats output
]);

// ---------------------------------------------------------------------------
// Public serializers
// ---------------------------------------------------------------------------

/**
 * Serialize a SyntaxToken to a plain JSON-serializable object.
 *
 * @param token  The token to serialize.
 * @param source Optional full source string for snippet extraction.
 */
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

/**
 * Serialize a SyntaxNode to a plain JSON-serializable object.
 * Children are recursed; internal fields (id, parent, startPos, etc.) are stripped.
 * ProgramNode.source is stripped regardless.
 *
 * @param node   The node to serialize.
 * @param source Optional full source string for snippet extraction.
 */
export function serializeNode (node: SyntaxNode, source?: string): SerializedNode {
  const raw = node as unknown as Record<string, unknown>;

  const children: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(raw)) {
    if (NODE_SKIP.has(key)) continue;
    if (val === undefined) continue;
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

/**
 * Serialize a SymbolInfo (pre-built by parserStore) to a plain JSON-serializable object.
 * Members are recursed up to the depth already captured in SymbolInfo (max 4).
 *
 * @param sym The SymbolInfo to serialize.
 */
export function serializeSymbol (sym: SymbolInfo): SerializedSymbol {
  const result: SerializedSymbol = {
    context: {
      id: symbolReadableId(sym),
      declPos: sym.declPos ?? undefined,
    },
  };
  if (!result.context.declPos) delete result.context.declPos;
  if (sym.members.length > 0) {
    result.members = sym.members.map(serializeSymbol);
  }
  return result;
}

// ---------------------------------------------------------------------------
// Internal recursive value serializer
// ---------------------------------------------------------------------------

function serializeValue (val: unknown, source?: string): unknown {
  if (val === null || val === undefined) return val;
  if (typeof val !== 'object') return val;
  if (Array.isArray(val)) return val.map((v) => serializeValue(v, source));

  // Duck-type SyntaxNode: has a numeric `start` and a `kind` string
  const obj = val as Record<string, unknown>;
  if (typeof obj.kind === 'string' && typeof obj.start === 'number' && obj.startPos) {
    return serializeNode(val as SyntaxNode, source);
  }
  // Duck-type SyntaxToken: has `value` string and numeric `start` and no `body`/`children`
  if (typeof obj.kind === 'string' && typeof obj.value === 'string' && typeof obj.start === 'number' && !obj.startPos && Array.isArray(obj.leadingTrivia)) {
    return serializeToken(val as SyntaxToken, source);
  }

  // Plain object — serialize recursively, skip internal keys
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (NODE_SKIP.has(k) || v === undefined) continue;
    result[k] = serializeValue(v, source);
  }
  return result;
}
