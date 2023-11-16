import { CompileError } from '../../errors';
import { ElementDeclarationNode, ProgramNode } from '../../parser/nodes';
import { pickBinder } from './utils';
import Report from '../../report';
import { SyntaxToken } from '../../lexer/tokens';

export default class Binder {
  private ast: ProgramNode;

  private errors: CompileError[];

  constructor(ast: ProgramNode) {
    this.ast = ast;
    this.errors = [];
  }

  resolve(): Report<ProgramNode, CompileError> {
    // eslint-disable-next-line no-restricted-syntax
    for (const element of this.ast.body) {
      if (element.type) {
        const _Binder = pickBinder(element as ElementDeclarationNode & { type: SyntaxToken });
        const binder = new _Binder(element, this.errors);
        binder.bind();
      }
    }

    return new Report(this.ast, this.errors);
  }
}
