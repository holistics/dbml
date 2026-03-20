import { ElementDeclarationNode, ProgramNode, SyntaxToken } from '@/core/..';
import { CompileError } from '@/core/errors';
import SymbolFactory from '@/core/validator/symbol/factory';
import { ElementBinder, ElementBinderArgs, ElementBinderResult } from '../types';
import { BinderContext } from '@/core/types';

export default class ChecksBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private context: BinderContext;

  constructor ({ declarationNode, context }: ElementBinderArgs, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.context = context;
  }

  bind (): ElementBinderResult {
    return { errors: [] };
  }
}
