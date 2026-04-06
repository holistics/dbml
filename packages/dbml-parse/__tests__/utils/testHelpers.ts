import fs from 'node:fs';
import type { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { SyntaxToken } from '@/core/lexer/tokens';
import { ElementDeclarationNode, LiteralNode, SyntaxNode, VariableNode } from '@/core/parser/nodes';
import { getElementNameString } from '@/core/parser/utils';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/errors';
import type Compiler from '@/compiler';

export function scanTestNames (path: string) {
  const files = fs.readdirSync(path);

  return files.filter((fn) => fn.match(/\.in\./)).map((fn) => fn.split('.in.')[0]);
}

function getNameHint (node: SyntaxNode | SyntaxToken): string {
  if (node instanceof SyntaxToken) {
    return `:${node.value}`;
  }
  if (node instanceof VariableNode) {
    return `:${node.variable?.value || ''}`;
  }
  if (node instanceof LiteralNode) {
    return `:${node.literal?.value || ''}`;
  }
  if (node instanceof ElementDeclarationNode) {
    return `:${getElementNameString(node).unwrap_or(undefined) || ''}`;
  }
  return '';
}

// Output a human-readable id for node/token/symbol to:
// - Avoid snapshot brittleness
// - Easy for verification
function getReadableId (nodeOrSymbol: SyntaxNode | SyntaxToken | NodeSymbol): string | undefined {
  const node = (nodeOrSymbol instanceof SyntaxNode) || (nodeOrSymbol instanceof SyntaxToken) ? nodeOrSymbol : nodeOrSymbol?.declaration;
  if (!node) return undefined;

  const start = `L${node.startPos.line}:C${node.startPos.column}`;
  const end = `L${node.endPos.line}:C${node.endPos.column}`;
  const nameHint = getNameHint(node);

  return `${node.kind}${nameHint}@[${start}, ${end}]`;
}

// Output the code snippet for a node or a symbol for easy verfication
function getCodeSnippet (nodeOrSymbol: SyntaxNode | SyntaxToken | NodeSymbol, source: string): string | undefined {
  const node = (nodeOrSymbol instanceof SyntaxNode) || (nodeOrSymbol instanceof SyntaxToken) ? nodeOrSymbol : nodeOrSymbol?.declaration;

  if (!node) return undefined;

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
  | Snappable[]
  | Record<string, unknown>;

export function toSnapshot (
  compiler: Compiler,
  value: Snappable,
): unknown {
  if (Array.isArray(value)) {
    return value.map((v) => toSnapshot(compiler, v));
  }
  if (value instanceof CompileWarning) {
    return warningToSnapshot(compiler, value);
  }
  if (value instanceof CompileError) {
    return errorToSnapshot(compiler, value);
  }
  if (value instanceof SyntaxToken) {
    return syntaxTokenToSnapshot(compiler, value);
  }
  if (value instanceof SyntaxNode) {
    return syntaxNodeToSnapshot(compiler, value);
  }
  if (value === null) {
    return 'null';
  }
  // An adhoc check for NodeSymbol
  // because it's just an interface
  if (
    typeof value === 'object' && value !== null
    && 'id' in value
  ) {
    return symbolToSnapshot(compiler, value as NodeSymbol);
  }
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, value]) => [key, toSnapshot(compiler, value as Snappable)]));
  }
  return value;
}

export function errorToSnapshot (
  compiler: Compiler,
  error: CompileError,
): unknown {
  const {
    code,
    diagnostic,
    nodeOrToken,
    start,
    end,
  } = error;
  return {
    level: 'error',
    code: {
      value: code,
      name: CompileErrorCode[code],
    },
    diagnostic,
    ...(nodeOrToken instanceof SyntaxNode
      ? { node: syntaxNodeToSnapshot(compiler, nodeOrToken) }
      : { token: syntaxTokenToSnapshot(compiler, nodeOrToken as SyntaxToken) }),
    start,
    end,
  };
}

export function warningToSnapshot (
  compiler: Compiler,
  warning: CompileWarning,
): unknown {
  const {
    code,
    diagnostic,
    nodeOrToken,
    start,
    end,
  } = warning;
  return {
    level: 'warning',
    code: {
      value: code,
      name: CompileErrorCode[code],
    },
    diagnostic,
    ...(nodeOrToken instanceof SyntaxNode
      ? { node: syntaxNodeToSnapshot(compiler, nodeOrToken) }
      : { token: syntaxTokenToSnapshot(compiler, nodeOrToken as SyntaxToken) }),
    start,
    end,
  };
}

export function syntaxTokenToSnapshot (
  compiler: Compiler,
  token: SyntaxToken,
): unknown {
  const tokenReadableId = getReadableId(token);
  const snippet = getCodeSnippet(token, compiler.parse.source());
  const {
    kind,
    value,
    leadingTrivia,
    trailingTrivia,
    leadingInvalid,
    trailingInvalid,
    startPos,
    start,
    endPos,
    end,
    isInvalid,
  } = token;
  const result = {
    context: {
      id: tokenReadableId,
      snippet,
    },
    isInvalid,
    kind,
    value,
    startPos,
    endPos,
    start,
    end,
    leadingTrivia: leadingTrivia.map((t) => t.value),
    trailingTrivia: trailingTrivia.map((t) => t.value),
    leadingInvalid: leadingInvalid.map((t) => t.value),
    trailingInvalid: trailingInvalid.map((t) => t.value),
  };
  return result;
}

export function syntaxNodeToSnapshot (
  compiler: Compiler,
  node: SyntaxNode,
): unknown {
  const nodeReadableId = getReadableId(node);
  const snippet = getCodeSnippet(node, compiler.parse.source());
  const {
    kind,
    startPos,
    endPos,
    start,
    end,
    fullStart,
    fullEnd,
    symbol,
    referee,
    ...props
  } = node;
  if (node instanceof ElementDeclarationNode) {
    const parent = node.parent;
    if (parent && 'parent' in props) {
      props['parent'] = {
        id: getReadableId(parent),
        snippet: getCodeSnippet(parent, compiler.parse.source()),
      };
    }
  }
  const result = {
    context: {
      id: nodeReadableId,
      snippet,
    },
    kind,
    startPos,
    endPos,
    start,
    end,
    fullStart,
    fullEnd,
    symbol: symbol && symbolToSnapshot(compiler, symbol),
    referee: referee && symbolToSnapshot(compiler, referee),
    children: Object.fromEntries(
      Object.entries(props)
        .map(
          ([key, value]) =>
            [key, toSnapshot(compiler, value)],
        ),
    ),
  };
  return result;
}

export function symbolToSnapshot (
  compiler: Compiler,
  symbol?: NodeSymbol,
): unknown {
  if (!symbol) return undefined;
  const symbolReadableId = getReadableId(symbol);
  const snippet = getCodeSnippet(symbol, compiler.parse.source());
  const {
    symbolTable,
    declaration,
    references,
  } = symbol;
  return {
    context: {
      id: symbolReadableId,
      snippet,
    },
    members: symbolTable && [...symbolTable.entries()].map(([, value]) => symbolToSnapshot(compiler, value)),
    declaration: declaration && {
      id: getReadableId(declaration),
      snippet: getCodeSnippet(declaration, compiler.parse.source()),
    },
    references: references?.map((r) => ({
      id: getReadableId(r),
      snippet: getCodeSnippet(r, compiler.parse.source()),
    })),
  };
}
