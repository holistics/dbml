import { Filepath } from '@/core/types/filepath';
import { BlockExpressionNode, ElementDeclarationNode, type SyntaxNode } from '@/core/types/nodes';
import { SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { addDoubleQuoteIfNeeded } from '@/compiler/queries/utils';
import type { TextEdit } from './applyTextEdits';
import { expandToWholeLines } from './removeElement';
import { findNamedElementDeclaration } from './updateElementSetting';
import { formatNoteString } from './utils';
import { findArchElement } from './utils/arch';

// An architecture file declares its sticky notes as elements with the Note role
function findStickyNote (compiler: Compiler, filepath: Filepath, name: string): SyntaxNode | undefined {
  return findNamedElementDeclaration(compiler, filepath, { kind: SymbolKind.StickyNote, name })
    ?? findArchElement(compiler, filepath, name, 'Note');
}

/**
 * Adds a sticky note `Note name [color: …] { 'text' }` at the end of the file.
 */
export function createStickyNoteEdit (
  this: Compiler,
  filepath: Filepath,
  name: string,
  text: string,
  color?: string,
): TextEdit[] {
  const source = this.getSource(filepath) ?? '';
  const settings = color ? ` [color: ${color}]` : '';
  const block = `Note ${addDoubleQuoteIfNeeded(name)}${settings} {\n  ${formatNoteString(text)}\n}`;
  return [
    {
      start: source.length,
      end: source.length,
      newText: `\n\n${block}\n`,
    },
  ];
}

/**
 * Replaces the text of sticky note `name`. No edits when there is no such note.
 */
export function setStickyNoteTextEdit (
  this: Compiler,
  filepath: Filepath,
  name: string,
  text: string,
): TextEdit[] {
  const declaration = findStickyNote(this, filepath, name);
  const body = declaration instanceof ElementDeclarationNode ? declaration.body : undefined;
  if (!(body instanceof BlockExpressionNode)) return [];

  const newText = formatNoteString(text);
  const content = body.body[0];
  if (content) return [{ start: content.start, end: content.end, newText }];

  const { blockOpenBrace, blockCloseBrace } = body;
  if (!blockOpenBrace || !blockCloseBrace) return [];
  return [{ start: blockOpenBrace.end, end: blockCloseBrace.start, newText: `\n  ${newText}\n` }];
}

/**
 * Removes sticky note `name` with its whole lines. No edits when there is no such note.
 */
export function removeStickyNoteEdit (
  this: Compiler,
  filepath: Filepath,
  name: string,
): TextEdit[] {
  const declaration = findStickyNote(this, filepath, name);
  if (!declaration) return [];
  return [expandToWholeLines(this.getSource(filepath) ?? '', declaration.start, declaration.end)];
}
