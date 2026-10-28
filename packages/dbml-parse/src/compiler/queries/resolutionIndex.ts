import { getMemberChain } from '@/core/parser/utils';
import { InternedNodeMetadata, MetadataElementMetadata, NodeMetadata } from '@/core/types/symbol/metadata';
import { UNHANDLED } from '@/core/types/module';
import {
  SyntaxNode,
  type InfixExpressionNode,
  TupleExpressionNode,
} from '@/core/types/nodes';
import {
  type InternedNodeSymbol,
  type NodeSymbol,
} from '@/core/types/symbol';
import { getRightmostVariable, isAccessExpression, isExpressionAVariableNode } from '@/core/utils/validate';
import type Compiler from '../index';

export interface ResolutionIndex {
  references: Map<InternedNodeSymbol, SyntaxNode[]>;
  metadata: Map<InternedNodeSymbol | InternedNodeMetadata, NodeMetadata[]>;
  parents: Map<InternedNodeSymbol, NodeSymbol[]>;
}

// Build full resolution index: references + metadata + symbol parent, one scan of all files
// A symbol's metadata is the metadata targeting it or any of its members (recursively, through `use`/alias to the original),
// a metadata's (e.g. a Ref's) metadata is the metadata directly targeting it (see NodeMetadata.targets).
// Each list is deduped and ordered by file order of parseProject then declaration start.
export function resolutionIndex (this: Compiler): ResolutionIndex {
  const references = new Map<InternedNodeSymbol, SyntaxNode[]>();
  const metadata = new Map<InternedNodeSymbol | InternedNodeMetadata, NodeMetadata[]>();

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

  const pushMetadata = (meta: NodeMetadata) => {
    for (const target of meta.targets(this)) {
      const key = target.intern();
      let arr = metadata.get(key);
      if (!arr) {
        arr = [];
        metadata.set(key, arr);
      }
      arr.push(meta);
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
        const leftExpr = (node.parentNode as InfixExpressionNode).leftExpression;
        if (leftExpr) {
          const tableNode = getRightmostVariable(leftExpr);
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
      let arr = parents.get(childKey);
      if (!arr) {
        arr = [];
        parents.set(childKey, arr);
      }
      arr.push(symbol);

      buildParents(compiler, child);
    }
  }

  for (const astReport of astMap.values()) {
    const ast = astReport.getValue().ast;
    const programSymbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
    if (programSymbol) buildParents(this, programSymbol);
  }

  // Accumulate each symbol's metadata from its members
  const fileOrder = new Map<string, number>();
  [...astMap.keys()].forEach((absolute, i) => fileOrder.set(absolute, i));
  const rank = (meta: NodeMetadata) => fileOrder.get(meta.declaration.filepath.absolute) ?? Number.MAX_SAFE_INTEGER;

  const accumulated = new Map(metadata);
  const visitedAccumulate = new Set<InternedNodeSymbol>();

  function accumulate (compiler: Compiler, symbol: NodeSymbol): NodeMetadata[] {
    const key = symbol.intern();
    if (visitedAccumulate.has(key)) return accumulated.get(key) ?? [];
    visitedAccumulate.add(key);

    const result = new Map<InternedNodeMetadata, NodeMetadata>();
    for (const meta of metadata.get(key) ?? []) result.set(meta.intern(), meta);
    for (const member of compiler.symbolMembers(symbol).getFiltered(UNHANDLED) ?? []) {
      for (const meta of accumulate(compiler, member.originalSymbol)) result.set(meta.intern(), meta);
    }

    const sorted = [...result.values()].sort((a, b) => (rank(a) - rank(b)) || (a.declaration.start - b.declaration.start));
    accumulated.set(key, sorted);
    return sorted;
  }

  for (const astReport of astMap.values()) {
    const ast = astReport.getValue().ast;
    const programSymbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
    if (programSymbol) accumulate(this, programSymbol);
  }

  return {
    references,
    metadata: accumulated,
    parents,
  };
}

// Lookup parent symbols that contain this symbol as a member
export function symbolParents (this: Compiler, symbol: NodeSymbol): NodeSymbol[] {
  const index = this.resolutionIndex();
  return index.parents.get(symbol.intern()) ?? [];
}

// Lookup references for a symbol from the cached index
export function symbolReferences (this: Compiler, symbol: NodeSymbol): SyntaxNode[] {
  const index = this.resolutionIndex();
  return index.references.get(symbol.intern()) ?? [];
}

// Lookup metadata targeting a symbol or any of its members, or directly targeting a metadata acting as a Target (e.g. a Ref), from the cached index
export function symbolMetadata (this: Compiler, target: NodeSymbol | NodeMetadata): NodeMetadata[] {
  const index = this.resolutionIndex();
  return index.metadata.get(target.intern()) ?? [];
}
