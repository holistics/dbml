import {
  ElementDeclarationNode, ProgramNode, SyntaxNode,
} from '@/core/types/nodes';
import type Compiler from '../index';

export function scope (
  this: Compiler,
  node: SyntaxNode,
): Readonly<ElementDeclarationNode | ProgramNode> {
  let current: SyntaxNode | undefined = node.parent;

  while (current) {
    if (current instanceof ElementDeclarationNode || current instanceof ProgramNode) {
      return current;
    }
    current = current.parent;
  }

  return this.parse.ast(node.filepath);
}
