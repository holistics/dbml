import { ElementDeclarationNode, ProgramNode, SyntaxToken } from '../../../..';
import { CompileError } from '../../../errors';
import SymbolFactory from '../../symbol/factory';
import { ElementBinder, ElementBinderArgs, ElementBinderResult } from '../types';
import { BinderContext } from '@/core/analyzer/analyzer';

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
