import { ElementDeclarationNode, MetadataDeclarationNode, SyntaxNode } from '@/core/types/nodes';
import { SyntaxToken } from '@/core/types/tokens';

export function isOffsetWithinSpan (offset: number, nodeOrToken: SyntaxNode | SyntaxToken): boolean {
  return offset >= nodeOrToken.start && offset < nodeOrToken.end;
}

// Check if offset is within the element/metadata header (before the body)
export function isOffsetWithinElementHeader (offset: number, element: ElementDeclarationNode | MetadataDeclarationNode): boolean {
  const bodyStart = element.bodyColon?.start ?? element.body?.start;
  if (bodyStart !== undefined) {
    return offset >= element.start && offset < bodyStart;
  }
  return offset >= element.start && offset <= element.end;
}
