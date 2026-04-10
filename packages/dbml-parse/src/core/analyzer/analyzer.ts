import Validator from '@/core/analyzer/validator/validator';
import Binder from '@/core/analyzer/binder/binder';
import { ProgramNode } from '@/core/parser/nodes';
import Report from '@/core/types/report';
import { NodeSymbolIdGenerator } from '@/core/types/symbol/symbols';
import SymbolFactory from '@/core/types/symbol/factory';

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
