import type Compiler from '@/compiler';
import { ElementDeclarationNode, SyntaxNode } from '@/core/types/nodes';
import { SyntaxToken } from '@/core/types/tokens';

export function isOffsetWithinSpan (offset: number, nodeOrToken: SyntaxNode | SyntaxToken): boolean {
  return offset >= nodeOrToken.start && offset < nodeOrToken.end;
}

// Check if offset is within the element header (type, name, alias, settings - before the body)
export function isOffsetWithinElementHeader (offset: number, element: ElementDeclarationNode): boolean {
  const bodyStart = element.bodyColon?.start ?? element.body?.start;
  if (bodyStart !== undefined) {
    return offset >= element.start && offset < bodyStart;
  }
  return offset >= element.start && offset <= element.end;
}

export function getSourceSnippet (compiler: Compiler, node: SyntaxNode | SyntaxToken): string | undefined {
  const source = compiler.getSource(node.filepath);
  if (!source) return undefined;
  return source.slice(node.start, node.end).trim();
}
