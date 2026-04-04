import { ElementDeclarationNode, ProgramNode } from '../../parser/nodes';
import { SyntaxToken } from '../../lexer/tokens';
import { CompileError } from '../../errors';
import Compiler from '@/compiler';

export default class ChecksBinder {
  private compiler: Compiler;
  private declarationNode: ElementDeclarationNode & { type: SyntaxToken };
  private ast: ProgramNode | undefined;

  constructor (declarationNode: ElementDeclarationNode & { type: SyntaxToken }, compiler: Compiler) {
    this.declarationNode = declarationNode;
    this.ast = undefined;
    this.compiler = compiler;
  }

  bind (): CompileError[] {
    return [];
  }
}
