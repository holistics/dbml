import { Filepath } from '@/core/types/filepath';
import { SymbolKind } from '@/core/types/symbol';
import { extractSettingName } from '@/core/utils/expression';
import { findSetting, updateSettingEdit } from '@/core/utils/setting';
import type Compiler from '../../index';
import type { TextEdit } from './applyTextEdits';
import type { ArchElementIdentifier, ElementIdentifier } from './types';
import { findNamedElementDeclaration } from './updateElementSetting';
import { formatNoteString } from './utils';
import { findArchElement } from './utils/arch';

/**
 * Sets the note of a table, field, table group or architecture node or group, keeping the form it is
 * written in (a body `Note:` line or a `note:` setting) and its spelling. Without a note, a `note:` setting
 * is added. `null` removes the note.
 */
export function setNoteEdit (
  this: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
  text: string | null,
): TextEdit[] {
  const declaration = target.kind === SymbolKind.Element
    ? findArchElement(this, filepath, (target as ArchElementIdentifier).name, (target as ArchElementIdentifier).role)
    : findNamedElementDeclaration(this, filepath, target);
  if (!declaration) return [];

  const located = findSetting(declaration, 'note');
  let settingName = 'note';
  if (located?.kind === 'body') settingName = located.declaration.type?.value ?? 'Note';
  if (located?.kind === 'attribute') settingName = extractSettingName(located.settingNode) ?? 'note';

  const value = text === null ? null : formatNoteString(text);
  const edit = updateSettingEdit(declaration, settingName, value, this.getSource(filepath) ?? '');
  return edit ? [edit] : [];
}
