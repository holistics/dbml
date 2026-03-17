import type Compiler from '../../index';
import type { SyntaxNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/analyzer/symbol/symbols';

export function nodeSymbol (this: Compiler, node: SyntaxNode): NodeSymbol | undefined {
  return this.analyzeProject().getValue().nodeToSymbol.get(node);
}

export function nodeReferences (this: Compiler, node: SyntaxNode): SyntaxNode[] {
  return this.analyzeProject().getValue().nodeToSymbol.get(node)?.references ?? [];
}

export function nodeReferee (this: Compiler, node: SyntaxNode): NodeSymbol | undefined {
  return this.analyzeProject().getValue().nodeToReferee.get(node);
}
