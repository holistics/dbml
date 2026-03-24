import type Compiler from '../../index';
import type { Filepath } from '../../projectLayout';
import { ElementDeclarationNode, ProgramNode } from '@/core/parser/nodes';

export function containerElement (
  this: Compiler,
  offset: number,
  filepath: Filepath,
): Readonly<ElementDeclarationNode | ProgramNode> {
  const containers = this.container.stack(offset, filepath);

  for (let i = containers.length - 1; i >= 0; i -= 1) {
    if (containers[i] instanceof ElementDeclarationNode) {
      return containers[i] as ElementDeclarationNode;
    }
  }

  return this.ast(filepath);
}
