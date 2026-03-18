import { SyntaxToken } from '../../../lexer/tokens';
import { ElementBinder, ElementBinderArgs, ElementBinderResult } from '../types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode,
} from '../../../parser/nodes';
import { CompileError } from '../../../errors';
import { pickBinder } from '../utils';
import SymbolFactory from '../../symbol/factory';
import { BinderContext } from '@/core/analyzer/analyzer';

export default class ProjectBinder implements ElementBinder {
  private symbolFactory: SymbolFactory;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private context: BinderContext;

  constructor ({ declarationNode, context }: ElementBinderArgs, symbolFactory: SymbolFactory) {
    this.declarationNode = declarationNode;
    this.symbolFactory = symbolFactory;
    this.context = context;
  }

  bind (): ElementBinderResult {
    if (!(this.declarationNode.body instanceof BlockExpressionNode)) {
      return { errors: [] };
    }

    return { errors: this.bindBody(this.declarationNode.body) };
  }

  private bindBody (body?: FunctionApplicationNode | BlockExpressionNode): CompileError[] {
    if (!body) {
      return [];
    }
    if (body instanceof FunctionApplicationNode) {
      return [];
    }

    const subs = body.body.filter((e) => e instanceof ElementDeclarationNode);

    return this.bindSubElements(subs as ElementDeclarationNode[]);
  }

  private bindSubElements (subs: ElementDeclarationNode[]): CompileError[] {
    return subs.flatMap((sub) => {
      if (!sub.type) {
        return [];
      }
      const _Binder = pickBinder(sub as ElementDeclarationNode & { type: SyntaxToken });
      const binder = new _Binder({ declarationNode: sub as ElementDeclarationNode & { type: SyntaxToken }, context: this.context }, this.symbolFactory);

      return binder.bind().errors;
    });
  }
}
