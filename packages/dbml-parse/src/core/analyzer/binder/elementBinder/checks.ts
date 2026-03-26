import { ElementDeclarationNode, ProgramNode, SyntaxToken } from '@/core/..';
import { CompileError } from '@/core/errors';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { ElementBinder } from '../types';
import { BinderContext } from '@/core/analyzer/analyzer';

export default class ChecksBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private context: BinderContext;

  constructor (
    declarationNode: ElementDeclarationNode & { type: SyntaxToken },
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
