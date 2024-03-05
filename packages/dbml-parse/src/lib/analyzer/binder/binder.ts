import { CompileError } from '@/lib/errors';
import { ElementDeclarationNode, ProgramNode } from '@/lib/parser/nodes';
import { pickBinder } from '@/lib/analyzer/binder/utils';
import Report from '@/lib/report';
import { SyntaxToken } from '@/lib/lexer/tokens';
import SymbolFactory from '@/lib/analyzer/symbol/factory';
import { getElementKind } from '@/lib/analyzer/utils';
import { ElementKind } from '@/lib/analyzer/types';
import TableBinder from './elementBinder/table';

export default class Binder {
  private ast: ProgramNode;

  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  private resolvePartialInjections (): CompileError[] {
    return this.ast.body.filter((e) => getElementKind(e).unwrap_or('') === ElementKind.Table).flatMap((t) => {
      const binder = new TableBinder(t as ElementDeclarationNode & { type: SyntaxToken }, this.ast, this.symbolFactory);
      return binder.resolvePartialInjections();
    });
  }

  resolve (): Report<ProgramNode, CompileError> {
    const errors: CompileError[] = [];
    // Must call this before binding
    errors.push(...this.resolvePartialInjections());

    for (const element of this.ast.body) {
      if (element.type) {
        const _Binder = pickBinder(element as ElementDeclarationNode & { type: SyntaxToken });
        const binder = new _Binder(element as ElementDeclarationNode & { type: SyntaxToken }, this.ast, this.symbolFactory);
        errors.push(...binder.bind());
      }
    }

    return new Report(this.ast, errors);
  }
}
