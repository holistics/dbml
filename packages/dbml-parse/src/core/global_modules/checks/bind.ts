import type {
  ElementDeclarationNode,
} from '@/core/types/nodes';
import type {
  SyntaxToken,
} from '@/core/types/tokens';
import type {
  CompileError,
} from '@/core/types/errors';
import type Compiler from '@/compiler';

export default class ChecksBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };

  constructor (compiler: Compiler, declarationNode: ElementDeclarationNode & { type: SyntaxToken }) {
    this.declarationNode = declarationNode;
    this.compiler = compiler;
  }

  bind (): CompileError[] {
    return [];
  }
}
