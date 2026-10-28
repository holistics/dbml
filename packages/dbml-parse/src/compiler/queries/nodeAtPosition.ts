import { getMemberChain } from '@/core/parser/utils';
import { type Filepath } from '@/core/types/filepath';
import { SyntaxNode } from '@/core/types/nodes';
import { SyntaxToken } from '@/core/types/tokens';
import { isOffsetWithinSpan } from '@/core/utils/span';
import type Compiler from '../index';

export function nodeAtPosition (this: Compiler, filepath: Filepath, offset: number): SyntaxNode | SyntaxToken | undefined {
  let currentNode: SyntaxNode = this.parse.ast(filepath);

  while (true) {
    const members = getMemberChain(currentNode);
    const found = members.find((mem) => isOffsetWithinSpan(offset, mem));

    if (found === undefined) {
      return currentNode;
    }

    if (found instanceof SyntaxToken) {
      return found;
    }

    currentNode = found;
  }
}
