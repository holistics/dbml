import type Compiler from '../index';
import { ElementDeclarationNode, ProgramNode, SyntaxNode } from '@/core/parser/nodes';

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

  return this._parse.ast();
}
