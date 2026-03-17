import Validator from '@/core/analyzer/validator/validator';
import Binder from '@/core/analyzer/binder/binder';
import { ProgramNode, SyntaxNode } from '@/core/parser/nodes';
import Report from '@/core/report';
import { NodeSymbolIdGenerator, NodeSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';

export type NodeToSymbolMap = WeakMap<SyntaxNode, NodeSymbol>;
export type NodeToRefereeMap = WeakMap<SyntaxNode, NodeSymbol>;
export type AnalysisResult = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
};

// Context passed to element binders — full maps + AST root
export type BinderContext = {
  ast: ProgramNode;
  nodeToSymbol: NodeToSymbolMap;
  nodeToReferee: NodeToRefereeMap;
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
    const validator = new Validator(this.ast, this.symbolFactory);
    const ast = this.ast;

    return validator.validate().chain((nodeToSymbol) => {
      const binder = new Binder({ ast, nodeToSymbol }, this.symbolFactory);
      return binder.resolve().map((nodeToReferee) => ({ ast, nodeToSymbol, nodeToReferee }));
    });
  }

  // For invoking the validator only
  validate (): Report<NodeToSymbolMap> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate();
  }

  // For invoking the binder only
  bind (nodeToSymbol: NodeToSymbolMap): Report<NodeToRefereeMap> {
    const binder = new Binder({ ast: this.ast, nodeToSymbol }, this.symbolFactory);

    return binder.resolve();
  }
}
