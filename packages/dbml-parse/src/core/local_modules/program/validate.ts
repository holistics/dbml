import Report from '@/core/report';
import { CompileError } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import Compiler from '@/compiler';

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
