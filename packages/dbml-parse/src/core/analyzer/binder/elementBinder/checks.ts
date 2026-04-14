import {
  CompileError,
} from '@/core/types/errors';
import SymbolFactory from '@/core/types/symbol/factory';
import {
  ElementDeclarationNode, ProgramNode, SyntaxToken,
} from '../../../..';
import {
  ElementBinder,
} from '../types';

export default class ChecksBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private ast: ProgramNode;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, ast: ProgramNode, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.ast = ast;
    this.symbolFactory = symbolFactory;
  }

  bind (): CompileError[] {
    return [];
  }
}
