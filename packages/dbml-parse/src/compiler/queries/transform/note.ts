/**
 * General-purpose note transforms for any element (table, table group, dep, etc.).
 *
 * Notes appear in two forms:
 *   - Body sub-element: `Note { 'text' }` or `Note: 'text'` (tables, table groups)
 *   - Body sub-declaration: `note: 'text'` (deps)
 *   - Setting attribute: `[note: 'text']` in a `[...]` list
 *
 * These transforms prioritize body notes over setting notes.
 */

import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  ListExpressionNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import { SyntaxNodeKind } from '@/core/types/nodes';
import { ElementKind, SettingName } from '@/core/types/keywords';
import { aggregateSettingList } from '@/core/utils/validate';
import type { TextEdit } from './applyTextEdits';
import { applyTextEdits } from './applyTextEdits';
import type { Filepath } from '@/core/types/filepath';
import type Compiler from '../../index';
import { quoteNoteValue } from '../utils';

interface NoteSetting {
  kind: SyntaxNodeKind.ELEMENT_DECLARATION | SyntaxNodeKind.ATTRIBUTE;
  /** Range of the note value (the quoted string). */
  noteValueStart: number;
  noteValueEnd: number;
  /** Range to delete when removing the note entirely. */
  fullNoteStart: number;
  fullNoteEnd: number;
}

/**
 * Produces a TextEdit that updates an existing note's value.
 * Returns undefined if no note exists.
 */
export function updateNoteEdit (declaration: SyntaxNode, newValue: string): TextEdit | undefined {
  const note = findNote(declaration);
  if (!note) return undefined;
  return { start: note.noteValueStart, end: note.noteValueEnd, newText: quoteNoteValue(newValue) };
}

/**
 * Produces a TextEdit that removes an existing note.
 * Returns undefined if no note exists.
 */
export function removeNoteEdit (declaration: SyntaxNode): TextEdit | undefined {
  const note = findNote(declaration);
  if (!note) return undefined;
  return { start: note.fullNoteStart, end: note.fullNoteEnd, newText: '' };
}

/**
 * Produces a TextEdit that adds a note to an element.
 * Prioritizes body note form for block elements, falls back to setting attribute.
 * Returns undefined if a note already exists.
 */
export function addNoteEdit (declaration: SyntaxNode, value: string): TextEdit | undefined {
  const existing = findNote(declaration);
  if (existing) return undefined;

  if (!(declaration instanceof ElementDeclarationNode)) return undefined;

  // For block-form elements, insert as a body sub-element
  const insertAt = findBodyInsertionPoint(declaration);
  if (insertAt !== undefined) {
    return { start: insertAt, end: insertAt, newText: `  note: ${quoteNoteValue(value)}\n` };
  }

  // For short-form elements, append as a setting attribute
  const body = declaration.body;
  if (body instanceof FunctionApplicationNode) {
    const settingsList = body.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode);
    if (settingsList && settingsList.listCloseBracket) {
      const sep = settingsList.elementList.length === 0 ? '' : ', ';
      return { start: settingsList.listCloseBracket.start, end: settingsList.listCloseBracket.start, newText: `${sep}note: ${quoteNoteValue(value)}` };
    }
    return { start: declaration.end, end: declaration.end, newText: ` [note: ${quoteNoteValue(value)}]` };
  }

  return undefined;
}

/**
 * Updates an existing note. If no note exists, adds one.
 */
export function updateNote (
  this: Compiler,
  filepath: Filepath,
  declaration: SyntaxNode,
  newValue: string,
): string | undefined {
  const source = this.getSource(filepath);
  if (!source) return undefined;

  const edit = updateNoteEdit(declaration, newValue) ?? addNoteEdit(declaration, newValue);
  if (!edit) return undefined;

  return applyTextEdits(source, [
    edit,
  ]);
}

/**
 * Removes an existing note.
 */
export function removeNote (
  this: Compiler,
  filepath: Filepath,
  declaration: SyntaxNode,
): string | undefined {
  const source = this.getSource(filepath);
  if (!source) return undefined;

  const edit = removeNoteEdit(declaration);
  if (!edit) return undefined;

  return applyTextEdits(source, [
    edit,
  ]);
}

/**
 * Adds a note. Returns undefined if a note already exists.
 */
export function addNote (
  this: Compiler,
  filepath: Filepath,
  declaration: SyntaxNode,
  value: string,
): string | undefined {
  const source = this.getSource(filepath);
  if (!source) return undefined;

  const edit = addNoteEdit(declaration, value);
  if (!edit) return undefined;

  return applyTextEdits(source, [
    edit,
  ]);
}

/**
 * Find an existing note in a declaration.
 * Checks body sub-elements first (Note { ... }), then body sub-declarations (note: '...'),
 * then setting attributes ([note: '...']).
 */
function findNote (declaration: SyntaxNode): NoteSetting | undefined {
  if (!(declaration instanceof ElementDeclarationNode)) return undefined;

  const body = declaration.body;

  // Body form: Note { 'text' } or Note: 'text' or note: 'text'
  if (body && !(body instanceof FunctionApplicationNode)) {
    for (const child of body.body) {
      if (!(child instanceof ElementDeclarationNode) || !child.isKind(ElementKind.Note)) continue;
      const valueNode = extractNoteValueNode(child);
      if (valueNode) {
        return {
          kind: SyntaxNodeKind.ELEMENT_DECLARATION,
          noteValueStart: valueNode.start,
          noteValueEnd: valueNode.end,
          fullNoteStart: child.start,
          fullNoteEnd: child.end,
        };
      }
    }
  }

  // Setting attribute: [note: 'text']
  const settingsList = declaration.attributeList
    ?? (body instanceof FunctionApplicationNode
      ? body.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode)
      : undefined);

  if (settingsList) {
    return findNoteInSettingsList(settingsList);
  }

  return undefined;
}

/**
 * Find where to insert a body note in a block-form element.
 * Returns the offset just before the closing `}`, or undefined for short-form elements.
 */
function findBodyInsertionPoint (declaration: ElementDeclarationNode): number | undefined {
  const body = declaration.body;
  if (!body || body instanceof FunctionApplicationNode) return undefined;
  if (body.blockCloseBrace) return body.blockCloseBrace.start;
  return undefined;
}

/** Extract the value node from a Note sub-element (short-form or block-form). */
function extractNoteValueNode (noteElement: ElementDeclarationNode): SyntaxNode | undefined {
  const subBody = noteElement.body;
  if (subBody instanceof FunctionApplicationNode) return subBody.callee ?? undefined;
  if (subBody instanceof BlockExpressionNode && subBody.body[0] instanceof FunctionApplicationNode) {
    return subBody.body[0].callee ?? undefined;
  }
  return undefined;
}

/** Find a note attribute inside a [...] setting list. */
function findNoteInSettingsList (settingsList: ListExpressionNode): NoteSetting | undefined {
  const settings = aggregateSettingList(settingsList).getValue();
  const noteAttrs = settings[SettingName.Note];
  if (!noteAttrs?.length) return undefined;

  const attr = noteAttrs[0];
  if (!attr.value) return undefined;

  const elements = settingsList.elementList;
  const i = elements.indexOf(attr);

  let fullNoteStart = attr.start;
  let fullNoteEnd = attr.end;
  if (elements.length === 1) {
    fullNoteStart = settingsList.start;
    fullNoteEnd = settingsList.end;
  } else if (i < elements.length - 1) {
    fullNoteEnd = elements[i + 1].start;
  } else {
    fullNoteStart = elements[i - 1].end;
  }

  return {
    kind: SyntaxNodeKind.ATTRIBUTE,
    noteValueStart: attr.value.start,
    noteValueEnd: attr.value.end,
    fullNoteStart,
    fullNoteEnd,
  };
}
