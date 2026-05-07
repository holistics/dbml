import {
  type Filepath,
} from '@/core/types';
import {
  ElementDeclarationNode, ProgramNode,
} from '@/core/types/nodes';
import type Compiler from '../../index';

export function containerElement (
  this: Compiler,
  filepath: Filepath,
  offset: number,
): Readonly<ElementDeclarationNode | ProgramNode> {
  const containers = this.container.stack(filepath, offset);

  for (let i = containers.length - 1; i >= 0; i -= 1) {
    if (containers[i] instanceof ElementDeclarationNode) {
      return containers[i] as ElementDeclarationNode;
    }
  }

  return this.parse.ast(filepath);
}
