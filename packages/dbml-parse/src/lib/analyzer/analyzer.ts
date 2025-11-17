import Validator from '@/lib/analyzer/validator/validator';
import Binder from '@/lib/analyzer/binder/binder';
import { ProgramNode } from '@/lib/parser/nodes';
import Report from '@/lib/report';
import { CompileError } from '@/lib/errors';
import { NodeSymbolIdGenerator } from '@/lib/analyzer/symbol/symbols';
import SymbolFactory from '@/lib/analyzer/symbol/factory';

export default class Analyzer {
  private ast: ProgramNode;
  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolIdGenerator: NodeSymbolIdGenerator) {
    this.ast = ast;
    this.symbolFactory = new SymbolFactory(symbolIdGenerator);
  }

  // Analyzing: Invoking both the validator and binder
  analyze (): Report<ProgramNode, CompileError> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate().chain((program) => {
      const binder = new Binder(program);

      return binder.resolve(this.symbolFactory);
    });
  }

  // For invoking the validator only
  validate (): Report<ProgramNode, CompileError> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate().chain((program) => new Report(program, []));
  }
}
