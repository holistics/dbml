import {
  emitMetadata, nodeReferee,
} from '@/core/global_modules';
import {
  getMemberChain,
} from '@/core/parser/utils';
import type {
  SymbolMetadata,
} from '@/core/types/metadata';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  InfixExpressionNode, SyntaxNode, TupleExpressionNode,
} from '@/core/types/nodes';
import {
  type InternedNodeSymbol, NodeSymbol,
} from '@/core/types/symbol';
import {
  isAccessExpression, isExpressionAVariableNode,
} from '@/core/utils/expression';
import type Compiler from '../index';

export interface ResolutionIndex {
  references: Map<InternedNodeSymbol, SyntaxNode[]>;
  metadata: Map<InternedNodeSymbol, SymbolMetadata[]>;
}

function getRightmostVariable (node: SyntaxNode): SyntaxNode | undefined {
  if (isExpressionAVariableNode(node)) return node;
  if (isAccessExpression(node)) {
    const right = (node as InfixExpressionNode).rightExpression;
    if (right && isExpressionAVariableNode(right)) return right;
  }
  return undefined;
}

// Build full resolution index: references + metadata. One scan of all files.
export function resolutionIndex (this: Compiler): ResolutionIndex {
  const references = new Map<InternedNodeSymbol, SyntaxNode[]>();
  const metadata = new Map<InternedNodeSymbol, SymbolMetadata[]>();

  const astMap = this.parseProject();
  this.bindProject();

  const seen = new Set<SyntaxNode>();
  const pushRef = (symbol: NodeSymbol, node: SyntaxNode) => {
    if (seen.has(node)) return;
    seen.add(node);
    const key = symbol.intern();
    let arr = references.get(key);
    if (!arr) { arr = []; references.set(key, arr); }
    arr.push(node);

    const original = symbol.originalSymbol;
    if (original !== symbol) {
      const origKey = original.intern();
      let origArr = references.get(origKey);
      if (!origArr) { origArr = []; references.set(origKey, origArr); }
      origArr.push(node);
    }
  };

  const pushMetadata = (m: SymbolMetadata) => {
    const key = m.target.intern();
    let arr = metadata.get(key);
    if (!arr) { arr = []; metadata.set(key, arr); }
    arr.push(m);
  };

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
      for (const metadata of emitMetadata(this, node)) {
        pushMetadata(metadata);
      }
      for (const child of getMemberChain(node)) {
        if (child instanceof SyntaxNode) walk(child);
      }
    };
    walk(ast);
  }

  return {
    references,
    metadata,
  };
}

// Lookup references for a symbol from the cached index
export function symbolReferences (this: Compiler, symbol: NodeSymbol): SyntaxNode[] {
  const index = this.resolutionIndex();
  return index.references.get(symbol.intern()) ?? [];
}

// Lookup metadata for a symbol from the cached index
export function symbolMetadata (this: Compiler, symbol: NodeSymbol): SymbolMetadata[] {
  const index = this.resolutionIndex();
  return index.metadata.get(symbol.intern()) ?? [];
}
