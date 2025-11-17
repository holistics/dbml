import { CompileError } from '@/lib/errors';
import { ElementDeclarationNode, ProgramNode } from '@/lib/parser/nodes';
import { pickBinder } from '@/lib/analyzer/binder/utils';
import Report from '@/lib/report';
import { SyntaxToken } from '@/lib/lexer/tokens';
import SymbolFactory from '@/lib/analyzer/symbol/factory';

export default class Binder {
  private ast: ProgramNode;

  private errors: CompileError[];

  constructor (ast: ProgramNode) {
    this.ast = ast;
    this.errors = [];
  }

  resolve (symbolFactory: SymbolFactory): Report<ProgramNode, CompileError> {
    // Resolve injected fields and sub elements before binding
    this.ast.body
      .map((element) => {
        if (!element.type) return null;

        const _Binder = pickBinder(element as ElementDeclarationNode & { type: SyntaxToken });
        const binder = new _Binder(element, this.errors);
        binder.resolveInjections(symbolFactory);
        return binder;
      })
      .forEach((binder) => binder?.bind());

    return new Report(this.ast, this.errors);
  }
}
