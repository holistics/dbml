import Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  ElementKind,
} from '@/core/types/keywords';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  SyntaxToken,
} from '@/core/types/tokens';

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
