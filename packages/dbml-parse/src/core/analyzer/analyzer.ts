import Validator from '@/core/analyzer/validator/validator';
import Binder from '@/core/analyzer/binder/binder';
import { ProgramNode, SyntaxNode } from '@/core/parser/nodes';
import Report from '@/core/report';
import { NodeSymbolIdGenerator, NodeSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';

export type NodeToSymbolMap = WeakMap<SyntaxNode, NodeSymbol>;
export type NodeToRefereeMap = WeakMap<SyntaxNode, NodeSymbol>;
export type SymbolToReferencesMap = Map<NodeSymbol, SyntaxNode[]>;
export type AnalysisResult = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
  symbolToReferences: SymbolToReferencesMap;
};

// Context passed to element binders — full maps + AST root
export type BinderContext = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
  symbolToReferences: SymbolToReferencesMap;
};

export default class Analyzer {
  private ast: ProgramNode;
  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolIdGenerator: NodeSymbolIdGenerator) {
    this.ast = ast;
    this.symbolFactory = new SymbolFactory(symbolIdGenerator);
  }

  // Analyzing: Invoking both the validator and binder
  analyze (): Report<AnalysisResult> {
    const validator = new Validator({ ast: this.ast }, this.symbolFactory);
    const ast = this.ast;

    return validator.validate().chain((nodeToSymbol) => {
      const symbolToReferences: SymbolToReferencesMap = new Map();
      const binder = new Binder({ ast, nodeToSymbol, symbolToReferences }, this.symbolFactory);
      return binder.resolve().map((nodeToReferee) => ({ ast, nodeToSymbol, nodeToReferee, symbolToReferences }));
    });
  }

  // For invoking the validator only
  validate (): Report<NodeToSymbolMap> {
    const validator = new Validator({ ast: this.ast }, this.symbolFactory);

    return validator.validate();
  }

  // For invoking the binder only
  bind (nodeToSymbol: NodeToSymbolMap, symbolToReferences?: SymbolToReferencesMap): Report<{ nodeToReferee: NodeToRefereeMap; symbolToReferences: SymbolToReferencesMap }> {
    const refs = symbolToReferences ?? new Map();
    const binder = new Binder({ ast: this.ast, nodeToSymbol, symbolToReferences: refs }, this.symbolFactory);

    return binder.resolve().map((nodeToReferee) => ({ nodeToReferee, symbolToReferences: refs }));
  }
}
