import { ElementDeclarationNode, ProgramNode, SyntaxToken } from '../../../..';
import { CompileError } from '../../../errors';
import SymbolFactory from '../../symbol/factory';
import { ElementBinder } from '../types';
import { BinderContext } from '@/core/binder/analyzer';

export default class ChecksBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private context: BinderContext;

  constructor (
    { declarationNode }: {
      declarationNode: ElementDeclarationNode & { type: SyntaxToken };
    },
    context: BinderContext,
    symbolFactory: SymbolFactory,
  ) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.context = context;
  }

  bind (): CompileError[] {
    return [];
  }
}
