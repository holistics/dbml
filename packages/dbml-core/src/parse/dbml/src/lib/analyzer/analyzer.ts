import Validator from './validator/validator';
import Binder from './binder/binder';
import { ProgramNode } from '../parser/nodes';
import Report from '../report';
import { CompileError } from '../errors';
import { NodeSymbolIdGenerator } from './symbol/symbols';
import SymbolFactory from './symbol/factory';

export default class Analyzer {
  private ast: ProgramNode;
  private symbolFactory: SymbolFactory;

  constructor(ast: ProgramNode, symbolIdGenerator: NodeSymbolIdGenerator) {
    this.ast = ast;
    this.symbolFactory = new SymbolFactory(symbolIdGenerator);
  }

  // Analyzing: Invoking both the validator and binder
  analyze(): Report<ProgramNode, CompileError> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate().chain(({ program, bindingRequests }) => {
      const binder = new Binder(program, bindingRequests);

      return binder.resolve();
    });
  }

  // For invoking the validator only
  validate(): Report<ProgramNode, CompileError> {
    const validator = new Validator(this.ast, this.symbolFactory);

    return validator.validate().chain(({ program }) => new Report(program, []));
  }
}
