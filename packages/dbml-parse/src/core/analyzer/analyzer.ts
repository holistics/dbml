import Validator from '@/core/analyzer/validator/validator';
import Binder from '@/core/analyzer/binder/binder';
import { ProgramNode } from '@/core/parser/nodes';
import Report from '@/core/report';
import { NodeSymbolIdGenerator } from '@/core/analyzer/symbol/symbols';
import SymbolFactory from '@/core/analyzer/symbol/factory';

export default class Analyzer {
  private ast: ProgramNode;
  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolIdGenerator: NodeSymbolIdGenerator) {
    this.ast = ast;
    this.symbolFactory = new SymbolFactory(symbolIdGenerator);
  }

  // Analyzing: Invoking the validator
  analyze (): Report<ProgramNode> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate().chain((program) => {
      const binder = new Binder(program, this.symbolFactory);

      return binder.resolve();
    });
  }

  validate (): Report<ProgramNode> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate().chain((program) => new Report(program, []));
  }
}
