import { CompileError } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { pickBinder } from '@/core/analyzer/binder/utils';
import Report from '@/core/report';
import { SyntaxToken } from '@/core/lexer/tokens';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { getElementKind } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import TableBinder from './elementBinder/table';
import { NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap, BinderContext } from '@/core/analyzer/analyzer';

export default class Binder {
  private ast: ProgramNode;

  private symbolFactory: SymbolFactory;

  private nodeToSymbol: NodeToSymbolMap;

  private symbolToReferences: SymbolToReferencesMap;

  constructor ({ ast, nodeToSymbol, symbolToReferences }: { ast: ProgramNode; nodeToSymbol: NodeToSymbolMap; symbolToReferences: SymbolToReferencesMap }, symbolFactory: SymbolFactory) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
    this.nodeToSymbol = nodeToSymbol;
    this.symbolToReferences = symbolToReferences;
  }

  private resolvePartialInjections (context: BinderContext): CompileError[] {
    return this.ast.body.filter((e) => getElementKind(e).unwrap_or('') === ElementKind.Table).flatMap((t) => {
      const binder = new TableBinder(t as ElementDeclarationNode & { type: SyntaxToken }, context, this.symbolFactory);
      return binder.resolvePartialInjections();
    });
  }

  resolve (): Report<NodeToRefereeMap> {
    const errors: CompileError[] = [];
    const nodeToReferee: NodeToRefereeMap = new WeakMap();
    const context: BinderContext = { ast: this.ast, nodeToSymbol: this.nodeToSymbol, nodeToReferee, symbolToReferences: this.symbolToReferences };

    // Must call this before binding
    errors.push(...this.resolvePartialInjections(context));

    for (const element of this.ast.body) {
      if (element.type) {
        const _Binder = pickBinder(element as ElementDeclarationNode & { type: SyntaxToken });
        const binder = new _Binder(element as ElementDeclarationNode & { type: SyntaxToken }, context, this.symbolFactory);
        errors.push(...binder.bind());
      }
    }

    return new Report(nodeToReferee, errors);
  }
}
