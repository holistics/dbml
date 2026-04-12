import { CompileError } from '@/core/types/errors';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import { pickBinder } from '@/core/analyzer/binder/utils';
import Report from '@/core/types/report';
import { SyntaxToken } from '@/core/types/tokens';
import SymbolFactory from '@/core/types/symbol/factory';
import { ElementKind } from '@/core/analyzer/types';
import TableBinder from './elementBinder/table';

export default class Binder {
  private ast: ProgramNode;

  private symbolFactory: SymbolFactory;

  constructor (ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  private resolvePartialInjections (): CompileError[] {
    return this.ast.body.filter((e) => e.isKind(ElementKind.Table)).flatMap((t) => {
      const binder = new TableBinder(t as ElementDeclarationNode & { type: SyntaxToken }, this.ast, this.symbolFactory);
      return binder.resolvePartialInjections();
    });
  }

  resolve (): Report<ProgramNode> {
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
