import { CompileError } from '@/core/errors';
import { ElementBinder } from '../types';
import {
  BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode,
} from '@/core/parser/nodes';
import { SyntaxToken } from '@/core/lexer/tokens';
import { pickBinder } from '../utils';
import SymbolFactory from '@/core/analyzer/validator/symbol/factory';
import { BinderContext } from '@/core/types';

export default class CustomBinder implements ElementBinder {
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
        sub as ElementDeclarationNode & { type: SyntaxToken },
        this.context,
        this.symbolFactory,
      );

      return binder.bind();
    });
  }
}
