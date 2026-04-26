import type Compiler from '@/compiler';
import type {
  CompileError,
} from '@/core/types/errors';
import type {
  ElementDeclarationNode,
} from '@/core/types/nodes';
import type {
  SyntaxToken,
} from '@/core/types/tokens';

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
