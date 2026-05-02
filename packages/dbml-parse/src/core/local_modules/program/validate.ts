import Compiler from '@/compiler';
import type {
  CompileError, CompileWarning,
} from '@/core/types/errors';
import {
  ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';

export default class ProgramValidator {
  private ast: ProgramNode;

  private compiler: Compiler;

  constructor (compiler: Compiler, ast: ProgramNode) {
    this.ast = ast;
    this.compiler = compiler;
  }

  validate (): Report<ProgramNode> {
    const errors: CompileError[] = [];
    const warnings: CompileWarning[] = [];

    for (const element of this.ast.body) {
      const result = this.compiler.validateNode(element);
      errors.push(...result.getErrors());
      warnings.push(...result.getWarnings());
    }

    return new Report(this.ast, errors, warnings);
  }
}
