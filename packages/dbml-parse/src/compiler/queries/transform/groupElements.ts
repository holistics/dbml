import { addDoubleQuoteIfNeeded } from '@/compiler/queries/utils';
import { archSort, handleOf, roleOf } from '@/core/arch';
import { Filepath } from '@/core/types/filepath';
import { BlockExpressionNode, type ElementDeclarationNode, type SyntaxNode } from '@/core/types/nodes';
import type Compiler from '../../index';
import type { TextEdit } from './applyTextEdits';
import { groupMemberEdits } from './removeElement';
import type { ArchElementIdentifier } from './types';
import {
  archDeclarations, findArchElement, formatRoleQualifiedName, refersTo,
} from './utils/arch';

const GROUP_ROLE = 'Group';

/**
 * Puts `members` in a new group `name`: each leaves the group that listed it, the new group joins
 * `parent`, and its block goes at the end of the file. Members that are not declared are left out.
 */
export function groupElementsEdit (
  this: Compiler,
  filepath: Filepath,
  members: ArchElementIdentifier[],
  parent: string | null,
  name: string,
): TextEdit[] {
  const targets = findElements(this, filepath, members);
  if (targets.length === 0) return [];

  const source = this.getSource(filepath) ?? '';
  const isTarget = (node: SyntaxNode) => targets.some((target) => refersTo(this, node, target));
  const edits: TextEdit[] = [];
  for (const declaration of archDeclarations(this, filepath)) {
    if (archSort(declaration) === 'group') edits.push(...groupMemberEdits(source, declaration, isTarget));
  }

  const parentGroup = parent === null ? undefined : findArchElement(this, filepath, parent, GROUP_ROLE);
  const joinParent = parentGroup && addMembersEdit(source, parentGroup, [formatRoleQualifiedName(name, GROUP_ROLE)]);
  if (joinParent) edits.push(joinParent);

  const block = `Group ${addDoubleQuoteIfNeeded(name)} {\n${targets.map((target) => `  ${writtenName(target)}`).join('\n')}\n}`;
  edits.push(appendEdit(source, edits, block));
  return edits;
}

/**
 * Removes group `handle`: its block goes, and its members join `parent` in its place.
 */
export function ungroupElementsEdit (
  this: Compiler,
  filepath: Filepath,
  handle: string,
  members: ArchElementIdentifier[],
  parent: string | null,
): TextEdit[] {
  const group = findArchElement(this, filepath, handle, GROUP_ROLE);
  if (!group) return [];

  const source = this.getSource(filepath) ?? '';
  const edits: TextEdit[] = [
    blockEdit(source, group),
  ];

  const parentGroup = parent === null ? undefined : findArchElement(this, filepath, parent, GROUP_ROLE);
  if (parentGroup) {
    edits.push(...groupMemberEdits(source, parentGroup, (node) => refersTo(this, node, group)));
    const joinParent = addMembersEdit(source, parentGroup, findElements(this, filepath, members).map(writtenName));
    if (joinParent) edits.push(joinParent);
  }
  return edits;
}

function findElements (compiler: Compiler, filepath: Filepath, members: ArchElementIdentifier[]): ElementDeclarationNode[] {
  return members
    .map((member) => findArchElement(compiler, filepath, member.name, member.role))
    .filter((declaration): declaration is ElementDeclarationNode => !!declaration);
}

// By full name (`Server api`). A bare handle could mean another element that shares it.
const writtenName = (declaration: ElementDeclarationNode): string => formatRoleQualifiedName(handleOf(declaration) ?? '', roleOf(declaration) ?? '');

// Each name on a line of its own, before the closing brace: a role cannot be written on the line of `{`
function addMembersEdit (source: string, group: ElementDeclarationNode, names: string[]): TextEdit | undefined {
  if (names.length === 0 || !(group.body instanceof BlockExpressionNode)) return undefined;
  const { blockOpenBrace, blockCloseBrace } = group.body;
  if (!blockOpenBrace || !blockCloseBrace) return undefined;

  const lines = names.map((written) => `  ${written}\n`).join('');
  const inner = source.slice(blockOpenBrace.end, blockCloseBrace.start);
  if (!inner.includes('\n')) {
    let start = blockCloseBrace.start;
    while (start > blockOpenBrace.end && (source[start - 1] === ' ' || source[start - 1] === '\t')) start -= 1;
    return { start, end: blockCloseBrace.start, newText: `\n${lines}` };
  }
  const at = blockOpenBrace.end + inner.lastIndexOf('\n') + 1;
  return { start: at, end: at, newText: lines };
}

function appendEdit (source: string, edits: TextEdit[], block: string): TextEdit {
  let start = source.length;
  while (start > 0 && /\s/.test(source[start - 1]!)) start -= 1;
  start = Math.max(start, ...edits.map((edit) => edit.end));
  return { start, end: source.length, newText: `\n\n${block}\n` };
}

function blockEdit (source: string, declaration: ElementDeclarationNode): TextEdit {
  let end = declaration.end;
  while (source[end] === '\n' || source[end] === '\r') end += 1;
  return { start: declaration.start, end, newText: '' };
}
