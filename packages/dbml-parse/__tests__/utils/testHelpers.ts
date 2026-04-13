import fs from 'node:fs';
import { NodeSymbol, SchemaSymbol, SymbolKind } from '@/core/types/symbol';
import { SyntaxToken } from '@/core/types/tokens';
import { ElementDeclarationNode, FunctionApplicationNode, FunctionExpressionNode, LiteralNode, PrimaryExpressionNode, ProgramNode, SyntaxNode, VariableNode } from '@/core/types/nodes';
import { getElementNameString } from '@/core/utils/expression';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/types/errors';
import type Compiler from '@/compiler';
import { UNHANDLED } from '@/constants';
import { Filepath, SchemaElement, TokenPosition } from '@/core/types';
import { isEmpty } from 'lodash-es';

export function scanTestNames (path: string) {
  const files = fs.readdirSync(path);

  return files.filter((fn) => fn.match(/\.in\./)).map((fn) => fn.split('.in.')[0]);
}

function getNameHint (node: SyntaxNode | SyntaxToken): string {
  if (node instanceof SyntaxToken) {
    return `${node.value}`;
  }
  if (node instanceof VariableNode) {
    return `${node.variable?.value || ''}`;
  }
  if (node instanceof LiteralNode) {
    return `${node.literal?.value || ''}`;
  }
  if (node instanceof FunctionExpressionNode) {
    return `${node.value?.value || ''}`;
  }
  if (node instanceof FunctionApplicationNode && node.callee) {
    return getNameHint(node.callee);
  }
  if (node instanceof PrimaryExpressionNode && node.expression) {
    return getNameHint(node.expression);
  }
  if (node instanceof ElementDeclarationNode) {
    return `${getElementNameString(node) || ''}`;
  }
  return '';
}

// Output a human-readable id for node/token/symbol to:
// - Avoid snapshot brittleness
// - Easy for verification
function getReadableId (nodeOrSymbol: SyntaxNode | SyntaxToken | NodeSymbol): string | undefined {
  const type = nodeOrSymbol instanceof SyntaxNode ? 'node' : nodeOrSymbol instanceof SyntaxToken ? 'token' : 'symbol';

  const node = (nodeOrSymbol instanceof SyntaxNode) || (nodeOrSymbol instanceof SyntaxToken) ? nodeOrSymbol : nodeOrSymbol?.declaration;

  const rawKind = nodeOrSymbol.kind;
  // Normalize Program kind to Schema to hide module-system-3 structural difference
  const kind = rawKind === SymbolKind.Program ? SymbolKind.Schema : rawKind;

  const start = `L${node?.startPos.line ?? '?'}:C${node?.startPos.column ?? '?'}`;
  const end = `L${node?.endPos.line ?? '?'}:C${node?.endPos.column ?? '?'}`;
  const nameHint = node ? getNameHint(node) : nodeOrSymbol instanceof SchemaSymbol ? nodeOrSymbol.qualifiedName.join('.') : '';

  return `${type}@${kind}@${nameHint}@[${start}, ${end}]`;
}

// Output the code snippet for a node or a symbol for easy verfication
function getCodeSnippet (nodeOrSymbol: SyntaxNode | SyntaxToken | NodeSymbol, compiler: Compiler): string | undefined {
  const node = (nodeOrSymbol instanceof SyntaxNode) || (nodeOrSymbol instanceof SyntaxToken) ? nodeOrSymbol : nodeOrSymbol?.declaration;

  if (!node) return undefined;

  const source = compiler.layout.getSource(node.filepath) ?? compiler.parse.source();
  const text = source.slice(node.start, node.end);
  if (text.length <= 20) {
    return text;
  }

  return `${text.slice(0, 10)}...${text.slice(-10)}`;
}

export type Snappable =
  | string | number | null | undefined | boolean | bigint | symbol
  | CompileWarning
  | CompileError
  | SyntaxNode
  | SyntaxToken
  | NodeSymbol
  | SchemaElement;

// Accept an object
// Output a stable key-value object
function sortObject (object: Record<string, unknown>): Record<string, unknown> {
  const entries = Object.entries(object).filter(([, value]) => !isEmpty(value) || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean');
  entries.sort(
    ([key1], [key2]) => key1 < key2 ? -1 : key1 > key2 ? 1 : 0,
  );
  return Object.fromEntries(entries);
}

function compareRank (a: number | string, b: number | string): number {
  if (Number.isNaN(a) && Number.isNaN(b)) return 0;
  if (Number.isNaN(a)) return -1;
  if (Number.isNaN(b)) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
}

// Accept an array
// Output a stable array
function sortArray (array: unknown[]): unknown[] {
  // A stable ranking among different kinds of values
  function getInterKindRank (s: unknown): number {
    if (s === null) return -2;
    if (typeof s === 'undefined') return -1;
    if (typeof s === 'string') return 0;
    if (typeof s === 'number') return 1;
    if (typeof s === 'boolean') return 2;
    if (typeof s === 'bigint') return 3;
    if (typeof s === 'symbol') return 4;
    if (s instanceof CompileWarning) return 5;
    if (s instanceof CompileError) return 6;
    if (s instanceof SyntaxNode) return 7;
    if (s instanceof SyntaxToken) return 8;
    if ((s as any)?.token) return 9; // possibly a schema element
    return 1000;
  }

  // Primary rank for values within a given kind
  function getIntraKindRank (s: unknown): number | string {
    if (s === null || s === undefined) return 0;
    if (typeof s === 'string' || typeof s === 'number') return s;
    if (typeof s === 'boolean') return Number(s);
    if (typeof s === 'bigint') return Number(s);
    if (typeof s === 'symbol') return s.toString();
    if (s instanceof CompileWarning || s instanceof CompileError) return (s as any).nodeOrToken?.start ?? 0;
    if (s instanceof SyntaxNode) return s.start;
    if (s instanceof SyntaxToken) return s.start;
    if ((s as any)?.declaration) return getIntraKindRank((s as any).declaration);
    if ((s as any)?.token) return ((s as any).token as TokenPosition)?.start?.offset ?? 0; // possibly a schema element
    if ((s as any)?.id) return getIntraKindRank((s as any).id);
    if (typeof s === 'object') {
      return getIntraKindRank(Object.values(sortObject(s as Record<string, unknown>))[0]);
    }
    return 0;
  }

  // Secondary tiebreaker when primary rank is equal
  function getTiebreakerRank (s: unknown): number | string {
    if (s instanceof CompileWarning || s instanceof CompileError) return s.diagnostic;
    if (s instanceof SyntaxNode) return s.id;
    if (s instanceof SyntaxToken) return s.value ?? '';
    if ((s as any)?.id !== undefined) return (s as any).id;
    return 0;
  }

  return array.sort((s1, s2) => {
    const interDiff = getInterKindRank(s1) - getInterKindRank(s2);
    if (interDiff !== 0) return interDiff;

    const intraDiff = compareRank(getIntraKindRank(s1), getIntraKindRank(s2));
    if (intraDiff !== 0) return intraDiff;

    return compareRank(getTiebreakerRank(s1), getTiebreakerRank(s2));
  });
}

// Get a stable snapshot of the value
export function toSnapshot (
  compiler: Compiler,
  value: Readonly<Snappable | readonly Readonly<Snappable>[] | Record<string, Readonly<Snappable> | readonly Readonly<Snappable>[]>>,
  { simple = false, includeReferences = true, includeSymbols = true, includeReferee = true }: { simple?: boolean; includeReferences?: boolean; includeSymbols?: boolean; includeReferee?: boolean } = {},
): unknown {
  if (Array.isArray(value)) {
    return sortArray([...value]).map((v) => toSnapshot(compiler, v as Snappable, { simple, includeReferences, includeSymbols, includeReferee }));
  }
  if (value instanceof CompileWarning) {
    return warningToSnapshot(compiler, value, { simple });
  }
  if (value instanceof CompileError) {
    return errorToSnapshot(compiler, value, { simple });
  }
  if (value instanceof SyntaxToken) {
    return syntaxTokenToSnapshot(compiler, value, { simple });
  }
  if (value instanceof SyntaxNode) {
    return syntaxNodeToSnapshot(compiler, value, { simple, includeReferences, includeSymbols, includeReferee });
  }
  if (value === null) {
    return null;
  }
  // An adhoc check for NodeSymbol
  // because it's just an interface
  if (value instanceof NodeSymbol) {
    return symbolToSnapshot(compiler, value as NodeSymbol, { includeReferences });
  }
  if (value instanceof Filepath) {
    return value.absolute;
  }
  if (typeof value === 'object') {
    return sortObject(Object.fromEntries(
      Object.entries(value)
        .map(
          ([key, value]) => [key, toSnapshot(compiler, value as Snappable, { simple, includeReferences, includeSymbols, includeReferee })],
        ),
    ));
  }
  return value;
}

export function errorToSnapshot (
  compiler: Compiler,
  error: CompileError,
  { simple = false }: { simple?: boolean } = {},
): unknown {
  const {
    code,
    diagnostic,
    nodeOrToken,
    filepath,
  } = error;
  if (simple) {
    return sortObject({
      level: 'error',
      code: CompileErrorCode[code],
      diagnostic,
      filepath: filepath.toString(),
    });
  }
  return sortObject({
    level: 'error',
    code: CompileErrorCode[code],
    diagnostic,
    filepath: filepath.toString(),
    ...(nodeOrToken instanceof SyntaxNode
      ? { node: syntaxNodeToSnapshot(compiler, nodeOrToken, { simple: true }) }
      : { token: syntaxTokenToSnapshot(compiler, nodeOrToken as SyntaxToken, { simple: true }) }),
  });
}

export function warningToSnapshot (
  compiler: Compiler,
  warning: CompileWarning,
  { simple = false }: { simple?: boolean } = {},
): unknown {
  const {
    code,
    diagnostic,
    nodeOrToken,
    filepath,
  } = warning;
  if (simple) {
    return sortObject({
      level: 'warning',
      code: CompileErrorCode[code],
      diagnostic,
      filepath: filepath.toString(),
    });
  }
  return sortObject({
    level: 'warning',
    code: CompileErrorCode[code],
    diagnostic,
    filepath: filepath.toString(),
    ...(nodeOrToken instanceof SyntaxNode
      ? { node: syntaxNodeToSnapshot(compiler, nodeOrToken, { simple: true }) }
      : { token: syntaxTokenToSnapshot(compiler, nodeOrToken as SyntaxToken, { simple: true }) }),
  });
}

export function syntaxTokenToSnapshot (
  compiler: Compiler,
  token: SyntaxToken,
  { simple = false }: { simple?: boolean } = {},
): unknown {
  const tokenReadableId = getReadableId(token);
  const snippet = getCodeSnippet(token, compiler);
  const {
    kind, // Filter this out as it's in the readable id
    filepath,
    value,
    leadingTrivia,
    trailingTrivia,
    leadingInvalid, // Filter this out
    trailingInvalid, // Filter this out
    isInvalid,
    startPos, // Filter this out
    endPos, // Filter this out
    start, // Filter this out
    end, // Filter this out
  } = token;
  if (simple) {
    return {
      context: { // context should always be at the top
        id: tokenReadableId,
        snippet,
        isInvalid,
        filepath: filepath.absolute,
      },
    };
  }
  const result = {
    context: { // context should ways be at the top
      id: tokenReadableId,
      snippet,
    },
    ...sortObject({
      value,
      leadingTrivia: leadingTrivia.map((t) => t.value).join(''),
      trailingTrivia: trailingTrivia.map((t) => t.value).join(''),
    }),
  };
  return result;
}

export function syntaxNodeToSnapshot (
  compiler: Compiler,
  node: SyntaxNode,
  { simple = false, includeReferences = true, includeSymbols = true, includeReferee = true }: { simple?: boolean; includeReferences?: boolean; includeSymbols?: boolean; includeReferee?: boolean } = {},
): unknown {
  const nodeReadableId = getReadableId(node);
  const snippet = getCodeSnippet(node, compiler);
  const {
    id, // Filter this out
    parent, // Filter this out
    parentNode, // Filter this out
    kind, // Filter this out as it's in the readable id
    startPos, // Filter this out
    endPos, // Filter this out
    start, // Filter this out
    end, // Filter this out
    filepath,
    fullStart,
    fullEnd,
    ...props
  } = node;
  const symbol = compiler.nodeSymbol(node).getFiltered(UNHANDLED);
  const referee = compiler.nodeReferee(node).getFiltered(UNHANDLED);
  if (node instanceof ProgramNode) {
    delete (props as any).source;
  }
  if (simple) {
    return {
      context: { // context should always be at the top
        id: nodeReadableId,
        snippet,
      },
    };
  }
  const result = {
    context: { // context should ways be at the top
      id: nodeReadableId,
      snippet,
    },
    ...sortObject({
      symbol: includeSymbols ? symbol && symbolToSnapshot(compiler, symbol, { includeReferences }) : undefined,
      referee: includeReferee ? referee && symbolToSnapshot(compiler, referee, { simple: true }) : undefined,
      fullStart,
      fullEnd,
      children: sortObject(Object.fromEntries(
        Object.entries(props)
          .map(
            ([key, value]) =>
              [key, toSnapshot(compiler, value as Snappable | Snappable[] | Record<string, Snappable>, { includeReferences, includeSymbols, includeReferee })],
          ),
      )),
    }),
  };
  return result;
}

export function collectNodesWithReferee (compiler: Compiler, node: SyntaxNode): SyntaxNode[] {
  const result: SyntaxNode[] = [];
  if (compiler.nodeReferee(node).getFiltered(UNHANDLED)) result.push(node);

  const {
    id, parent, parentNode, kind, startPos, endPos, start, end, filepath, fullStart, fullEnd, symbol, referee, source, ...props
  } = node as SyntaxNode & Record<string, unknown>;

  for (const value of Object.values(props)) {
    if (value instanceof SyntaxNode) {
      result.push(...collectNodesWithReferee(compiler, value));
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item instanceof SyntaxNode) {
          result.push(...collectNodesWithReferee(compiler, item));
        }
      }
    }
  }

  return result;
}

export function symbolToSnapshot (
  compiler: Compiler,
  symbol: NodeSymbol,
  { simple = false, includeReferences = true }: { simple?: boolean; includeReferences?: boolean } = {},
): unknown {
  if (!symbol) return undefined;
  const symbolReadableId = getReadableId(symbol);
  const snippet = getCodeSnippet(symbol, compiler);
  const {
    id, // Filter this out
    declaration,
    filepath,
  } = symbol;
  const symbolTable = compiler.symbolMembers(symbol).getFiltered(UNHANDLED);
  const references = includeReferences ? compiler.symbolReferences(symbol).getFiltered(UNHANDLED) : undefined;

  if (simple) {
    return {
      context: {
        id: symbolReadableId, // context should always be at the top
        snippet,
      },
    };
  }
  return {
    context: { // context should ways be at the top
      id: symbolReadableId,
      snippet,
    },
    ...sortObject({
      members: symbolTable && (() => {
        const filtered = [...symbolTable.entries()].filter(([, sym]) => !(sym instanceof SchemaSymbol && sym.isPublicSchema()));
        return filtered.length > 0 ? sortArray(filtered.map(([, value]) => symbolToSnapshot(compiler, value, { simple: true }))) : undefined;
      })(),
      declaration: declaration && {
        id: getReadableId(declaration),
        snippet: getCodeSnippet(declaration, compiler),
      },
      references: references && sortArray(references.map((r) => ({
        id: getReadableId(r),
        snippet: getCodeSnippet(r, compiler),
      }))),
    }),
  };
}
