import {
  nodeReferee,
} from '@/core/global_modules';
import {
  getMemberChain,
} from '@/core/parser/utils';
import type {
  NodeMetadata,
} from '@/core/types/symbol/metadata';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  SyntaxNode,
  type InfixExpressionNode,
  TupleExpressionNode,
} from '@/core/types/nodes';
import {
  type InternedNodeSymbol,
  type NodeSymbol,
  SchemaSymbol,
  SymbolKind,
} from '@/core/types/symbol';
import {
  isAccessExpression, isExpressionAVariableNode,
} from '@/core/utils/validate';
import type Compiler from '../index';

export interface ResolutionIndex {
  references: Map<InternedNodeSymbol, SyntaxNode[]>;
  metadata: Map<InternedNodeSymbol, NodeMetadata[]>;
  parents: Map<InternedNodeSymbol, NodeSymbol[]>;
}

function getRightmostVariable (node: SyntaxNode): SyntaxNode | undefined {
  if (isExpressionAVariableNode(node)) return node;
  if (isAccessExpression(node)) {
    const right = (node as InfixExpressionNode).rightExpression;
    if (right && isExpressionAVariableNode(right)) return right;
  }
  return undefined;
}

// Build full resolution index: references + metadata + symbol parent. One scan of all files.
export function resolutionIndex (this: Compiler): ResolutionIndex {
  const references = new Map<InternedNodeSymbol, SyntaxNode[]>();
  const metadata = new Map<InternedNodeSymbol, NodeMetadata[]>();

  const astMap = this.parseProject();
  this.bindProject();

  const seen = new Set<SyntaxNode>();
  const pushRef = (symbol: NodeSymbol, node: SyntaxNode) => {
    if (seen.has(node)) return;
    seen.add(node);
    const key = symbol.intern();
    let arr = references.get(key);
    if (!arr) {
      arr = [];
      references.set(key, arr);
    }
    arr.push(node);

    const original = symbol.originalSymbol;
    if (original !== symbol) {
      const origKey = original.intern();
      let origArr = references.get(origKey);
      if (!origArr) {
        origArr = [];
        references.set(origKey, origArr);
      }
      origArr.push(node);
    }
  };

  const pushMetadata = (m: NodeMetadata) => {
    for (const symbol of m.owners(this)) {
      const key = symbol.intern();
      let arr = metadata.get(key);
      if (!arr) {
        arr = [];
        metadata.set(key, arr);
      }
      arr.push(m);
    }
  };

  // Build metadata and references
  for (const astReport of astMap.values()) {
    const ast = astReport.getValue().ast;
    const walk = (node: SyntaxNode): void => {
      // Collect references
      if (isExpressionAVariableNode(node)) {
        const ref = nodeReferee.call(this, node).getFiltered(UNHANDLED);
        if (ref) pushRef(ref, node);
        return;
      }
      // Tuple access: table.(col1, col2)
      if (node instanceof TupleExpressionNode
        && isAccessExpression(node.parentNode)
        && (node.parentNode as InfixExpressionNode).rightExpression === node) {
        const leftExpr = (node.parentNode as InfixExpressionNode).leftExpression;
        if (leftExpr) {
          const tableNode = getRightmostVariable(leftExpr);
          if (tableNode) {
            const ref = nodeReferee.call(this, tableNode).getFiltered(UNHANDLED);
            if (ref) pushRef(ref, tableNode);
          }
        }
      }
      // Collect metadata from all modules
      const metadata = this.nodeMetadata(node).getFiltered(UNHANDLED);
      if (metadata) {
        pushMetadata(metadata);
      }
      for (const child of getMemberChain(node)) {
        if (child instanceof SyntaxNode) walk(child);
      }
    };
    walk(ast);
  }

  // Build parent map: for every symbol, record which symbols contain it as a member
  const parents = new Map<InternedNodeSymbol, NodeSymbol[]>();
  const visitedSymbols = new Set<InternedNodeSymbol>();

  function buildParents (compiler: Compiler, symbol: NodeSymbol) {
    const key = symbol.intern();
    if (visitedSymbols.has(key)) return;
    visitedSymbols.add(key);

    const children = compiler.symbolMembers(symbol).getFiltered(UNHANDLED);
    if (!children) return;

    for (const child of children) {
      const childKey = child.intern();
      let arr = parents.get(childKey);
      if (!arr) {
        arr = [];
        parents.set(childKey, arr);
      }
      arr.push(symbol);

      if (child instanceof SchemaSymbol && child.isKind(SymbolKind.Schema)) {
        buildParents(compiler, child);
      }
    }
  }

  for (const astReport of astMap.values()) {
    const ast = astReport.getValue().ast;
    const programSymbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
    if (programSymbol) buildParents(this, programSymbol);
  }

  return {
    references,
    metadata,
    parents,
  };
}

// Lookup parent symbols that contain this symbol as a member
export function symbolParent (this: Compiler, symbol: NodeSymbol): NodeSymbol[] {
  const index = this.resolutionIndex();
  return index.parents.get(symbol.intern()) ?? [];
}

// Lookup references for a symbol from the cached index
export function symbolReferences (this: Compiler, symbol: NodeSymbol): SyntaxNode[] {
  const index = this.resolutionIndex();
  return index.references.get(symbol.intern()) ?? [];
}

// Lookup metadata for a symbol from the cached index
export function symbolMetadata (this: Compiler, symbol: NodeSymbol): NodeMetadata[] {
  const index = this.resolutionIndex();
  return index.metadata.get(symbol.intern()) ?? [];
}
