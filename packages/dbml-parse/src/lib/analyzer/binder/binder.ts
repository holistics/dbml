import { CompileError } from '../../errors';
import { ElementDeclarationNode, ProgramNode } from '../../parser/nodes';
import { pickBinder } from './utils';
import Report from '../../report';
import { SyntaxToken } from '../../lexer/tokens';
import SymbolFactory from '../symbol/factory';
import { getElementKind } from '../utils';
import { ElementKind } from '../types';
import TableBinder from './elementBinder/table';

export default class Binder {
  private ast: ProgramNode;

  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  private resolvePartialInjections (): CompileError[] {
    return this.ast.body.filter((e) => getElementKind(e).unwrapOr('') === ElementKind.Table).flatMap((t) => {
      const binder = new TableBinder(t as ElementDeclarationNode & { type: SyntaxToken }, this.ast, this.symbolFactory);
      return binder.resolvePartialInjections();
    });
  }

  resolve (): Report<ProgramNode, CompileError> {
    const errors: CompileError[] = [];
    // Must call this before binding
    errors.push(...this.resolvePartialInjections());
    // eslint-disable-next-line no-restricted-syntax
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
