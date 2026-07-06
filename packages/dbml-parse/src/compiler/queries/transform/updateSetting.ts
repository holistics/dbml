import { FunctionApplicationNode, ListExpressionNode, AttributeNode } from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { Filepath } from '@/core/types/filepath';
import type Compiler from '../../index';
import { type TextEdit, applyTextEdits } from './applyTextEdits';

// Find the settings list and a specific setting node by name within a declaration.
function findSetting (declaration: SyntaxNode, settingName: string, source: string): {
  settingsList: ListExpressionNode;
  settingNode: AttributeNode;
  settingIndex: number;
} | undefined {
  if (!(declaration instanceof FunctionApplicationNode)) return undefined;
  const settingsList = declaration.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode);
  if (!settingsList) return undefined;

  const elements = settingsList.elementList ?? [];
  const settingIndex = elements.findIndex((el) => {
    if (!(el instanceof AttributeNode)) return false;
    const text = source.substring(el.start, el.end).trim();
    return text === settingName || text.startsWith(`${settingName}:`);
  });
  if (settingIndex === -1) return undefined;

  return { settingsList, settingNode: elements[settingIndex] as AttributeNode, settingIndex };
}

// Produce a TextEdit that updates an existing setting's value in a declaration.
export function updateSettingEdit (
  declaration: SyntaxNode,
  settingName: string,
  newValue: string,
  source: string,
): TextEdit | undefined {
  const found = findSetting(declaration, settingName, source);
  if (!found) return undefined;

  return { start: found.settingNode.start, end: found.settingNode.end, newText: newValue };
}

// Produce a TextEdit that removes a setting from a declaration.
// If it's the only setting, removes the entire settings block [...].
export function removeSettingEdit (
  declaration: SyntaxNode,
  settingName: string,
  source: string,
): TextEdit | undefined {
  const found = findSetting(declaration, settingName, source);
  if (!found) return undefined;

  const { settingsList, settingIndex } = found;
  const elements = settingsList.elementList ?? [];

  // Only setting — remove the entire settings block including surrounding whitespace.
  if (elements.length === 1) {
    // Find leading whitespace before the [
    let removeStart = settingsList.start;
    while (removeStart > 0 && source[removeStart - 1] === ' ') removeStart--;
    return { start: removeStart, end: settingsList.end, newText: '' };
  }

  // Multiple settings — remove the setting and its separator.
  const settingNode = elements[settingIndex];
  if (settingIndex === 0) {
    // First setting: remove from start to beginning of next setting.
    const nextSetting = elements[settingIndex + 1];
    return { start: settingNode.start, end: nextSetting.start, newText: '' };
  }

  // Non-first setting: remove from end of previous setting to end of this one.
  const prevSetting = elements[settingIndex - 1];
  return { start: prevSetting.end, end: settingNode.end, newText: '' };
}

// Update an existing setting in a declaration and return the updated source.
export function updateSetting (
  this: Compiler,
  filepath: Filepath,
  declaration: SyntaxNode,
  settingName: string,
  newValue: string,
): string | undefined {
  const source = this.getSource(filepath);
  if (!source) return undefined;

  const edit = updateSettingEdit(declaration, settingName, newValue, source);
  if (!edit) return undefined;

  return applyTextEdits(source, [
    edit,
  ]);
}

// Remove a setting from a declaration and return the updated source.
export function removeSetting (
  this: Compiler,
  filepath: Filepath,
  declaration: SyntaxNode,
  settingName: string,
): string | undefined {
  const source = this.getSource(filepath);
  if (!source) return undefined;

  const edit = removeSettingEdit(declaration, settingName, source);
  if (!edit) return undefined;

  return applyTextEdits(source, [
    edit,
  ]);
}
