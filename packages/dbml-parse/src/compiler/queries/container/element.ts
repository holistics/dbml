import { type Filepath } from '@/core/types/filepath';
import { ElementDeclarationNode, ProgramNode } from '@/core/types/nodes';
import type Compiler from '../../index';

export function containerElement (
  this: Compiler,
  filepath: Filepath,
  offset: number,
): Readonly<ElementDeclarationNode | ProgramNode> {
  const containers = this.container.stack(filepath, offset);

  for (let index = containers.length - 1; index >= 0; index -= 1) {
    if (containers[index] instanceof ElementDeclarationNode) {
      return containers[index] as ElementDeclarationNode;
    }
  }

  return this.parse.ast(filepath);
}
