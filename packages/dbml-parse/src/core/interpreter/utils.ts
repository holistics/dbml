import type { SyntaxNode } from '@/core/types/nodes';
import type { SyntaxToken } from '@/core/types/tokens';
import type { TokenPosition } from '@/core/types/schemaJson';

export function getTokenPosition(nodeOrToken: SyntaxNode | SyntaxToken): TokenPosition {
  return {
    start: nodeOrToken.startPos,
    end: nodeOrToken.endPos,
    filepath: nodeOrToken.filepath,
  };
}
