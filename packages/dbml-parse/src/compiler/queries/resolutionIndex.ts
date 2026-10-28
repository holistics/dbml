import { getMemberChain } from '@/core/parser/utils';
import { MetadataElementMetadata, NodeMetadata } from '@/core/types/symbol/metadata';
import { UNHANDLED } from '@/core/types/module';
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
import { getRightmostVariable, isAccessExpression, isExpressionAVariableNode } from '@/core/utils/validate';
import type Compiler from '../index';

export interface ResolutionIndex {
  references: Map<InternedNodeSymbol, SyntaxNode[]>;
  metadata: Map<InternedNodeSymbol, NodeMetadata[]>;
  parents: Map<InternedNodeSymbol, NodeSymbol[]>;
}

// Build full resolution index: references + metadata + symbol parent, one scan of all files
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
    let array = references.get(key);
    if (!array) {
      array = [];
      references.set(key, array);
    }
    array.push(node);

    const original = symbol.originalSymbol;
    if (original !== symbol) {
      const originalKey = original.intern();
      let originalArray = references.get(originalKey);
      if (!originalArray) {
        originalArray = [];
        references.set(originalKey, originalArray);
      }
      originalArray.push(node);
    }
  };

  const pushMetadata = (nodeMetadata: NodeMetadata) => {
    if (nodeMetadata instanceof MetadataElementMetadata) {
      const target = nodeMetadata.target(this);
      if (!target) return;

      const key = target.intern();
      let array = metadata.get(key);
      if (!array) {
        array = [];
        metadata.set(key, array);
      }
      array.push(nodeMetadata);
      return;
    }

    for (const symbol of nodeMetadata.owners(this)) {
      const key = symbol.intern();
      let array = metadata.get(key);
      if (!array) {
        array = [];
        metadata.set(key, array);
      }
      array.push(nodeMetadata);
    }
  };

  // Build metadata and references
  for (const astReport of astMap.values()) {
    const ast = astReport.getValue().ast;
    const walk = (node: SyntaxNode): void => {
      // Collect references
      if (isExpressionAVariableNode(node)) {
        const ref = this.nodeReferee(node).getFiltered(UNHANDLED);
        if (ref) pushRef(ref, node);
        return;
      }
      // Tuple access: table.(col1, col2)
      if (node instanceof TupleExpressionNode
        && isAccessExpression(node.parentNode)
        && (node.parentNode as InfixExpressionNode).rightExpression === node) {
        const leftExpression = (node.parentNode as InfixExpressionNode).leftExpression;
        if (leftExpression) {
          const tableNode = getRightmostVariable(leftExpression);
          if (tableNode) {
            const ref = this.nodeReferee(tableNode).getFiltered(UNHANDLED);
            if (ref) pushRef(ref, tableNode);
          }
        }
      }
      // Collect metadata from all modules
      const metadata = this.nodeMetadata(node).getFiltered(UNHANDLED);
      if (metadata) pushMetadata(metadata);

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
      let array = parents.get(childKey);
      if (!array) {
        array = [];
        parents.set(childKey, array);
      }
      array.push(symbol);

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
