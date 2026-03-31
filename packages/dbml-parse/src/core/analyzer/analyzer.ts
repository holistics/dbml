import { ProgramNode, SyntaxNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import { InternedMap } from '@/core/internable';

export type NodeToSymbolMap = InternedMap<SyntaxNode, NodeSymbol>;
export type NodeToRefereeMap = InternedMap<SyntaxNode, NodeSymbol>;
export type SymbolToReferencesMap = InternedMap<NodeSymbol, SyntaxNode[]>;

export type AnalysisResult = {
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
  symbolToReferences: SymbolToReferencesMap;
};

export type BinderContext = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
  symbolToReferences: SymbolToReferencesMap;
};
