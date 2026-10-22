import {
  archSort, endpointNode, handleOf, inlineLinkOf, inlineLinksOf, isTopLevel, isTopLevelNote, linkPartsOf, nameOf,
} from '@/core/arch/read';
import { Filepath } from '@/core/types/filepath';
import type { AttributeNode, ElementDeclarationNode, ListExpressionNode } from '@/core/types/nodes';
import type Compiler from '../../../index';
import type { TextEdit } from '../applyTextEdits';

// A DBML file has no architecture declarations, so a `Table` is never taken for a node
export function archDeclarations (compiler: Compiler, filepath: Filepath): ElementDeclarationNode[] {
  const ast = compiler.parseFile(filepath).getValue().ast;
  if (compiler.parsedFileKind(filepath) !== 'arch') return [];
  return ast.body.filter(isTopLevel);
}

// A node, a group or a sticky note: what links and groups name
const isElement = (declaration: ElementDeclarationNode): boolean => {
  const sort = archSort(declaration);
  return sort === 'node' || sort === 'group' || isTopLevelNote(declaration);
};

export function findArchElement (compiler: Compiler, filepath: Filepath, handle: string): ElementDeclarationNode | undefined {
  return archDeclarations(compiler, filepath).find((d) => isElement(d) && handleOf(d) === handle);
}

export type ArchLinkDefinition =
  | { kind: 'standalone'; declaration: ElementDeclarationNode }
  | { kind: 'inline'; element: ElementDeclarationNode; attribute: AttributeNode; op: string };

const joins = (left: string | undefined, right: string | undefined, from: string, to: string): boolean => (
  (left === from && right === to) || (left === to && right === from)
);

// The first link between `from` and `to` in either direction, in source order: `Link: a > b` or an inline `[link: > b]` on `a`
export function findArchLink (compiler: Compiler, filepath: Filepath, from: string, to: string): ArchLinkDefinition | undefined {
  for (const declaration of archDeclarations(compiler, filepath)) {
    if (archSort(declaration) === 'link') {
      const parts = linkPartsOf(declaration);
      if (parts && joins(nameOf(endpointNode(parts.infix.left)), nameOf(endpointNode(parts.infix.right)), from, to)) {
        return { kind: 'standalone', declaration };
      }
      continue;
    }
    if (!isElement(declaration)) continue;
    for (const attribute of inlineLinksOf(declaration)) {
      const inline = inlineLinkOf(attribute);
      if (inline && joins(handleOf(declaration), nameOf(inline.target), from, to)) {
        return {
          kind: 'inline', element: declaration, attribute, op: inline.op,
        };
      }
    }
  }
  return undefined;
}

// Removes one setting from its `[ ]`, with its comma, or the whole `[ ]` when it was the only one
export function removeAttributeEdit (list: ListExpressionNode, attribute: AttributeNode, source: string): TextEdit {
  const elements = list.elementList ?? [];
  const index = elements.indexOf(attribute);
  if (elements.length === 1) {
    let start = list.start;
    while (start > 0 && source[start - 1] === ' ') start -= 1;
    return { start, end: list.end, newText: '' };
  }
  if (index === 0) return { start: attribute.start, end: elements[1]!.start, newText: '' };
  return { start: elements[index - 1]!.end, end: attribute.end, newText: '' };
}
