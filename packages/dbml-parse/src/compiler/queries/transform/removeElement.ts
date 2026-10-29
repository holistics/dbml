import {
  archSort, bodyOf, inlineLinkOf, inlineLinksOf, linkPartsOf, membersOf,
} from '@/core/arch/read';
import { resolveName } from '@/core/global_modules/arch/utils';
import { Filepath } from '@/core/types/filepath';
import { FunctionApplicationNode, ListExpressionNode, type SyntaxNode } from '@/core/types/nodes';
import { SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { TextEdit, applyTextEdits } from './applyTextEdits';
import {
  archDeclarations, findArchElement, refersTo, removeAttributeEdit,
} from './utils/arch';

/**
 * Removes an element with everything in the same file that names it: links to and from it, its
 * place in groups, and Metadata on it. Left behind, any of these would fail as an unknown name.
 * `role` picks among elements sharing the handle. An empty map means no change (lookup miss).
 */
export function removeElement (
  this: Compiler,
  filepath: Filepath,
  handle: string,
  role?: string,
): Map<string, string> {
  const target = findArchElement(this, filepath, handle, role);
  if (!target) return new Map();

  const source = this.getSource(filepath) ?? '';
  const names = (node: SyntaxNode | undefined): node is SyntaxNode => refersTo(this, node, target);
  const edits: TextEdit[] = [
    wholeLines(source, target.start, target.end),
  ];

  for (const declaration of archDeclarations(this, filepath)) {
    if (declaration === target) continue;

    switch (archSort(declaration)) {
      case 'link': {
        const parts = linkPartsOf(declaration);
        if (names(parts?.from?.node) || names(parts?.to?.node)) {
          edits.push(wholeLines(source, declaration.start, declaration.end));
        }
        continue;
      }

      case 'metadata': {
        const value = declaration.targetKind?.value;
        const named = declaration.name
          ? names(declaration.name)
          : !!value && resolveName(this, filepath, value, undefined, [SymbolKind.Element])?.originalSymbol.declaration === target;
        if (named) edits.push(wholeLines(source, declaration.start, declaration.end));
        continue;
      }

      case 'group': {
        const roleNodes = new Set(membersOf(declaration).refs.map((ref) => ref.roleNode));
        for (const row of bodyOf(declaration)) {
          if (!(row instanceof FunctionApplicationNode)) continue;
          // `Server api` on its own line is one member: its role goes with it
          const members = [
            row.callee,
            ...row.args,
          ].filter((node): node is SyntaxNode => !!node && !roleNodes.has(node));
          const hits = members.filter(names);
          if (!hits.length) continue;
          if (hits.length === members.length && onOwnLine(source, row.start, row.end)) {
            edits.push(wholeLines(source, row.start, row.end));
            continue;
          }
          for (const hit of hits) edits.push(memberEdit(source, hit));
        }
        break;
      }

      default:
        break;
    }

    if (declaration.attributeList instanceof ListExpressionNode) {
      for (const attribute of inlineLinksOf(declaration)) {
        if (names(inlineLinkOf(attribute)?.node)) edits.push(removeAttributeEdit(declaration.attributeList, attribute, source));
      }
    }
  }

  return new Map([
    [
      filepath.absolute,
      applyTextEdits(source, edits),
    ],
  ]);
}

const onOwnLine = (source: string, start: number, end: number): boolean => {
  const before = source.lastIndexOf('\n', start - 1) + 1;
  const after = source.indexOf('\n', end);
  return !source.slice(before, start).trim() && !source.slice(end, after === -1 ? source.length : after).trim();
};

// The span, widened to its whole lines and their line break when nothing else shares them
function wholeLines (source: string, start: number, end: number): TextEdit {
  if (!onOwnLine(source, start, end)) return { start, end, newText: '' };
  const lineStart = source.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = source.indexOf('\n', end);
  return { start: lineStart, end: lineEnd === -1 ? source.length : lineEnd + 1, newText: '' };
}

// One name out of `{ a b c }`, with the spaces on one side so the others stay one space apart
export function memberEdit (source: string, node: SyntaxNode): TextEdit {
  let end = node.end;
  while (source[end] === ' ' || source[end] === '\t') end += 1;
  if (end > node.end && source[end] !== '\n' && source[end] !== '}') return { start: node.start, end, newText: '' };
  let start = node.start;
  while (start > 0 && (source[start - 1] === ' ' || source[start - 1] === '\t')) start -= 1;
  return { start, end: node.end, newText: '' };
}
