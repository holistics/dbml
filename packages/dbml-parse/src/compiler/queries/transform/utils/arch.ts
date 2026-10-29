import { isValidIdentifier } from '@/compiler/queries/utils';
import {
  archSort, handleOf, inlineLinksOf, isTopLevel, isTopLevelNote, roleOf,
} from '@/core/arch/read';
import { resolveName, rolePrecedence } from '@/core/global_modules/arch/utils';
import { Filepath } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import type { AttributeNode, ElementDeclarationNode, ListExpressionNode, SyntaxNode } from '@/core/types/nodes';
import { LinkMetadata } from '@/core/types/symbol/metadata';
import { isExpressionAVariableNode } from '@/core/utils/validate';
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

// The element with that handle, and that role when one is given; else the first by NAME_PRECEDENCE
export function findArchElement (compiler: Compiler, filepath: Filepath, handle: string, role?: string): ElementDeclarationNode | undefined {
  return archDeclarations(compiler, filepath)
    .filter((d) => isElement(d) && handleOf(d) === handle && (!role || roleOf(d) === role))
    .sort((a, b) => rolePrecedence(roleOf(a)) - rolePrecedence(roleOf(b)))[0];
}

// Whether a name written in a link, a group or Metadata means `target`
export function refersTo (compiler: Compiler, node: SyntaxNode | undefined, target: ElementDeclarationNode): boolean {
  if (!node || !isExpressionAVariableNode(node)) return false;
  return compiler.nodeReferee(node).getFiltered(UNHANDLED)?.originalSymbol.declaration === target;
}

// How the app writes a reference to an element, group or sticky note: always its role and handle,
// so the reference means that element whatever else shares the handle
export const fullName = (handle: string, role: string): string => `${role} ${isValidIdentifier(handle) ? handle : `"${handle}"`}`;

export type ArchLinkDefinition =
  | { kind: 'standalone'; declaration: ElementDeclarationNode }
  | { kind: 'inline'; element: ElementDeclarationNode; attribute: AttributeNode; op: string };

// The first link between `from` and `to` in either direction, in source order: `Link: a > b` or an inline `[link: > b]` on `a`
export function findArchLink (compiler: Compiler, filepath: Filepath, from: string, to: string, fromRole?: string, toRole?: string): ArchLinkDefinition | undefined {
  const a = resolveName(compiler, filepath, from, fromRole)?.originalSymbol;
  const b = resolveName(compiler, filepath, to, toRole)?.originalSymbol;
  if (!a || !b) return undefined;
  const joins = ([left, right]: unknown[]) => (left === a && right === b) || (left === b && right === a);
  for (const declaration of archDeclarations(compiler, filepath)) {
    if (archSort(declaration) === 'link') {
      if (joins(new LinkMetadata(declaration).endpoints(compiler))) return { kind: 'standalone', declaration };
      continue;
    }
    if (!isElement(declaration)) continue;
    for (const attribute of inlineLinksOf(declaration)) {
      const metadata = new LinkMetadata(attribute);
      const op = metadata.op();
      if (op && joins(metadata.endpoints(compiler))) {
        return {
          kind: 'inline', element: declaration, attribute, op,
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
