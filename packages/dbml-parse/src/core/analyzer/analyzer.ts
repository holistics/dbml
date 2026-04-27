import Binder from '@/core/global_modules/program/bind';
import Validator from '@/core/local_modules/program/validate';
import {
  ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import SymbolFactory from '@/core/types/symbol/factory';
import {
  NodeSymbolIdGenerator,
} from '@/core/types/symbol/symbols';

export default class Analyzer {
  private ast: ProgramNode;
  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolIdGenerator: NodeSymbolIdGenerator) {
    this.ast = ast;
    this.symbolFactory = new SymbolFactory(symbolIdGenerator);
  }

  // Analyzing: Invoking both the validator and binder
  analyze (): Report<ProgramNode> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate().chain((program) => {
      const binder = new Binder(program, this.symbolFactory);

      return binder.resolve();
    });
  }

  // For invoking the validator only
  validate (): Report<ProgramNode> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate().chain((program) => new Report(program, []));
  }
}
