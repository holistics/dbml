import type Compiler from '@/compiler';
import type {
  CompileError,
} from '@/core/types/errors';
import type {
  ElementDeclarationNode,
} from '@/core/types/nodes';

export default class ChecksBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode;

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode) {
    this.compiler = compiler;
    this.declarationNode = declarationNode;
  }

  bind (): CompileError[] {
    return [];
  }
}
