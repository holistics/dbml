import { ProgramNode, SyntaxNode, type SyntaxNodeKey } from '@/core/parser/nodes';
import type { NodeSymbol, NodeSymbolKey } from '@/core/analyzer/symbol/symbols';

export type NodeToSymbolMap = Map<SyntaxNodeKey, NodeSymbol>;
export type NodeToRefereeMap = Map<SyntaxNodeKey, NodeSymbol>;
export type SymbolToReferencesMap = Map<NodeSymbolKey, SyntaxNode[]>;

export type AnalysisResult = {
  ast: ProgramNode;
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
