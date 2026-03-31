import { CompileError } from '../../../errors';
import { ElementBinder } from '../types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode,
} from '../../../parser/nodes';
import { SyntaxToken } from '../../../lexer/tokens';
import { pickBinder } from '../utils';
import SymbolFactory from '../../symbol/factory';
import { BinderContext } from '@/core/analyzer/analyzer';

export default class NoteBinder implements ElementBinder {
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
    return this.bindBody(this.declarationNode.body);
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
      const binder = new _Binder(
        { declarationNode: sub as ElementDeclarationNode & { type: SyntaxToken } },
        this.context,
        this.symbolFactory,
      );

      return binder.bind();
    });
  }
}
