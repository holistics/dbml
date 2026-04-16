import Compiler from '@/compiler';
import {
  CompileError,
} from '@/core/types/errors';
import {
  ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';

export default class ProgramValidator {
  private ast: ProgramNode;

  private compiler: Compiler;

  constructor (ast: ProgramNode, compiler: Compiler) {
    this.ast = ast;
    this.compiler = compiler;
  }

  validate (): Report<ProgramNode> {
    const errors: CompileError[] = [];

    // Validate all body elements (declarations + use statements)
    for (const element of this.ast.body) {
      errors.push(...this.compiler.validateNode(element).getErrors());
    }

    return new Report(this.ast, errors);
  }
}
