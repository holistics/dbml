import Report from '@/core/types/report';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import Compiler from '@/compiler';
import { SyntaxToken } from '@/core/types/tokens';
import { ElementKind } from '@/core/types/keywords';

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
