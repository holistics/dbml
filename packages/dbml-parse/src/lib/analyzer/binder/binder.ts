import { CompileError } from '../../errors';
import { ElementDeclarationNode, ProgramNode } from '../../parser/nodes';
import { pickBinder } from './utils';
import Report from '../../report';
import { SyntaxToken } from '../../lexer/tokens';

export default class Binder {
  private ast: ProgramNode;

  constructor(ast: ProgramNode) {
    this.ast = ast;
  }

  resolve(): Report<ProgramNode, CompileError> {
    const errors: CompileError[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const element of this.ast.body) {
      if (element.type) {
        const _Binder = pickBinder(element as ElementDeclarationNode & { type: SyntaxToken });
        const binder = new _Binder(element as ElementDeclarationNode & { type: SyntaxToken }, this.ast);
        errors.push(...binder.bind());
      }
    }

    return new Report(this.ast, errors);
  }
}
