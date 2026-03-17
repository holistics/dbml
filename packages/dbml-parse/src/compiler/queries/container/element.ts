import type Compiler from '../../index';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';

export function elementAtOffset (
  this: Compiler,
  offset: number,
): Readonly<ElementDeclarationNode | ProgramNode> {
  const containers = this.stackAtOffset(offset);

  for (let i = containers.length - 1; i >= 0; i -= 1) {
    if (containers[i] instanceof ElementDeclarationNode) {
      return containers[i] as ElementDeclarationNode;
    }
  }

  return this.ast();
}
