import Report from '@/core/report';
import { CompileError } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import Compiler from '@/compiler';
import { SyntaxToken } from '@/core/lexer/tokens';

export default class ProgramValidator {
  private ast: ProgramNode;

  private compiler: Compiler;

  constructor (ast: ProgramNode, compiler: Compiler) {
    this.ast = ast;
    this.compiler = compiler;
  }

  validate (): Report<ProgramNode> {
    const errors: CompileError[] = [];

    this.ast.declarations.forEach((element) => {
      if (element.type === undefined) {
        return;
      }

      const validatorReport = this.compiler.validateNode(
        element as ElementDeclarationNode & { type: SyntaxToken },
      );
      errors.push(...validatorReport.getErrors());
    });

    return new Report(this.ast, errors);
  }
}
