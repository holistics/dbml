import { CompileError } from '@/core/errors';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';
import { pickBinder } from '@/core/analyzer/binder/utils';
import Report from '@/core/report';
import { SyntaxToken } from '@/core/lexer/tokens';
import SymbolFactory from '@/core/analyzer/validator/symbol/factory';
import { getElementKind } from '@/core/utils';
import { ElementKind, NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap, BinderContext } from '@/core/types';
import TableBinder from './elementBinder/table';

export default class Binder {
  private ast: ProgramNode;

  private symbolFactory: SymbolFactory;

  private nodeToSymbol: NodeToSymbolMap;

  private nodeToReferee: NodeToRefereeMap;

  private symbolToReferences: SymbolToReferencesMap;

  constructor (
    { ast, nodeToSymbol, nodeToReferee, symbolToReferences }: {
      ast: ProgramNode;
      nodeToSymbol: NodeToSymbolMap;
      nodeToReferee?: NodeToRefereeMap;
      symbolToReferences?: SymbolToReferencesMap;
    },
    symbolFactory: SymbolFactory,
  ) {
    this.ast = ast;
    this.symbolFactory = symbolFactory;
    this.nodeToSymbol = nodeToSymbol;
    this.nodeToReferee = nodeToReferee ?? new WeakMap();
    this.symbolToReferences = symbolToReferences ?? new Map();
  }

  private resolvePartialInjections (context: BinderContext): CompileError[] {
    return this.ast.declarations.filter((e) => getElementKind(e).unwrap_or('') === ElementKind.Table).flatMap((t) => {
      const binder = new TableBinder(
        t as ElementDeclarationNode & { type: SyntaxToken },
        context,
        this.symbolFactory,
      );
      return binder.resolvePartialInjections();
    });
  }

  resolve (): Report<NodeToRefereeMap> {
    const errors: CompileError[] = [];
    const context: BinderContext = {
      filepath: this.symbolFactory.filepath,
      ast: this.ast,
      nodeToSymbol: this.nodeToSymbol,
      nodeToReferee: this.nodeToReferee,
      symbolToReferences: this.symbolToReferences,
    };

    // Must call this before binding
    errors.push(...this.resolvePartialInjections(context));

    for (const element of this.ast.declarations) {
      if (element.type) {
        const _Binder = pickBinder(element as ElementDeclarationNode & { type: SyntaxToken });
        const binder = new _Binder(
          element as ElementDeclarationNode & { type: SyntaxToken },
          context,
          this.symbolFactory,
        );
        errors.push(...binder.bind());
      }
    }

    return new Report(this.nodeToReferee, errors);
  }
}
