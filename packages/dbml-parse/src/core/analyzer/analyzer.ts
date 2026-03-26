import { ProgramNode, SyntaxNode } from '@/core/parser/nodes';
import type { NodeSymbol } from '@/core/analyzer/symbol/symbols';
import type { Filepath } from '@/compiler/projectLayout/filepath';

export type NodeToSymbolMap = Map<SyntaxNode, NodeSymbol>;
export type NodeToRefereeMap = WeakMap<SyntaxNode, NodeSymbol>;
export type SymbolToReferencesMap = Map<NodeSymbol, SyntaxNode[]>;

export type AnalysisResult = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
  symbolToReferences: SymbolToReferencesMap;
};

export type BinderContext = {
  filepath: Filepath;
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
  symbolToReferences: SymbolToReferencesMap;
};
