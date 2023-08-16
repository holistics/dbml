import Validator from './validator/validator';
import Binder from './binder/binder';
import { ProgramNode } from '../parser/nodes';
import Report from '../report';
import { CompileError } from '../errors';

export default class Analyzer {
  private ast: ProgramNode;

  constructor(ast: ProgramNode) {
    this.ast = ast;
  }

  // Analyzing: Invoking both the validator and binder
  analyze(): Report<ProgramNode, CompileError> {
    const validator = new Validator(this.ast);

    return validator.validate().chain(({ program, schema, unresolvedNames }) => {
      const binder = new Binder(program, schema, unresolvedNames);

      return binder.resolve();
    });
  }

  // For invoking the validator only
  validate(): Report<ProgramNode, CompileError> {
    const validator = new Validator(this.ast);

    return validator.validate().chain(({ program }) => new Report(program, []));
  }
}
