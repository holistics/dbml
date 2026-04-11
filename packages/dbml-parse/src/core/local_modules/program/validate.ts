import Report from '@/core/types/report';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import { ElementDeclarationNode, ProgramNode } from '@/core/types/nodes';
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

    this.ast.body.forEach((element) => {
      if (element.type === undefined) {
        return;
      }

      const validatorReport = this.compiler.validate(
        element as ElementDeclarationNode & { type: SyntaxToken },
      );
      errors.push(...validatorReport.getErrors());
    });

    return new Report(this.ast, errors);
  }
}
