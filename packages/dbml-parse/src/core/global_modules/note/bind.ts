import type Compiler from '@/compiler';
import type { CompileError } from '@/core/types/errors';
import {
  ElementDeclarationNode,
  type BlockExpressionNode,
  FunctionApplicationNode,
} from '@/core/types/nodes';

export default class NoteBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
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

      return this.compiler.bindNode(sub).getErrors();
    });
  }
}
