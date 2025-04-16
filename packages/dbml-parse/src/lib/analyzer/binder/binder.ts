import { CompileError } from '../../errors';
import { ElementDeclarationNode, ProgramNode } from '../../parser/nodes';
import { pickBinder } from './utils';
import Report from '../../report';
import { SyntaxToken } from '../../lexer/tokens';
import SymbolFactory from '../symbol/factory';

export default class Binder {
  private ast: ProgramNode;

  private errors: CompileError[];

  constructor(ast: ProgramNode) {
    this.ast = ast;
    this.errors = [];
  }

  resolve (symbolFactory: SymbolFactory): Report<ProgramNode, CompileError> {
    this.ast.body.forEach((element) => {
      if (element.type) {
        const _Binder = pickBinder(element as ElementDeclarationNode & { type: SyntaxToken });
        const binder = new _Binder(element, this.errors);
        binder.resolveInjections(symbolFactory);
      }
    });
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
