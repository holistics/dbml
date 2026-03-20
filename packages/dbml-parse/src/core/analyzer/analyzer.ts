import Validator from '@/core/analyzer/validator/validator';
import Binder from '@/core/analyzer/binder/binder';
import { ProgramNode, SyntaxNode } from '@/core/parser/nodes';
import Report from '@/core/report';
import { NodeSymbolIdGenerator, NodeSymbol } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import type { Filepath } from '@/compiler/projectLayout';

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
  private filepath: Filepath;
  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolIdGenerator: NodeSymbolIdGenerator, filepath: Filepath) {
    this.ast = ast;
    this.filepath = filepath;
    this.symbolFactory = new SymbolFactory(symbolIdGenerator);
  }

  analyze (): Report<AnalysisResult> {
    const validator = new Validator({ ast: this.ast, filepath: this.filepath }, this.symbolFactory);
    const ast = this.ast;

    return validator.validate().chain(({ nodeToSymbol }) => {
      const binder = new Binder({ ast, nodeToSymbol }, this.symbolFactory);
      return binder.resolve().map((nodeToReferee) => ({ ast, nodeToSymbol, nodeToReferee }));
    });
  }

  validate () {
    const validator = new Validator({ ast: this.ast, filepath: this.filepath }, this.symbolFactory);
    return validator.validate();
  }

  bind (nodeToSymbol: NodeToSymbolMap): Report<NodeToRefereeMap> {
    const binder = new Binder({ ast: this.ast, nodeToSymbol }, this.symbolFactory);
    return binder.resolve();
  }
}
