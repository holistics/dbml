/**
 * General-purpose setting edit utilities for any element declaration.
 * Produces TextEdits for adding, updating, and removing settings in [...] blocks.
 */

import {
  FunctionApplicationNode, ListExpressionNode, AttributeNode, ElementDeclarationNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { TextEdit } from '@/compiler/queries/transform/applyTextEdits';

/**
 * Produces a TextEdit that adds a setting to a field/element declaration.
 * If the declaration already has a settings block [...], inserts before the closing ].
 * Otherwise, appends a new [setting] block.
 */
export function addSettingEdit (declaration: SyntaxNode, setting: string): TextEdit | undefined {
  if (declaration instanceof FunctionApplicationNode) {
    const settingsList = declaration.args.find((a) => a instanceof ListExpressionNode);
    if (settingsList) {
      const insertOffset = settingsList.end - 1;
      return { start: insertOffset, end: insertOffset, newText: `, ${setting}` };
    }
  }

  return { start: declaration.end, end: declaration.end, newText: ` [${setting}]` };
}

/**
 * Produces a TextEdit that updates an existing setting's value in a declaration.
 */
export function updateSettingEdit (
  declaration: SyntaxNode,
  settingName: string,
  newValue: string,
  source: string,
): TextEdit | undefined {
  const found = findSetting(source, declaration, settingName);
  if (!found) return undefined;

  return { start: found.settingNode.start, end: found.settingNode.end, newText: newValue };
}

/**
 * Produces a TextEdit that removes a setting from a declaration.
 * If it's the only setting, removes the entire settings block [...].
 */
export function removeSettingEdit (
  declaration: SyntaxNode,
  settingName: string,
  source: string,
): TextEdit | undefined {
  const found = findSetting(source, declaration, settingName);
  if (!found) return undefined;

  const { settingsList, settingIndex } = found;
  const elements = settingsList.elementList ?? [];

  // Only setting - remove the entire settings block including surrounding whitespace.
  if (elements.length === 1) {
    let removeStart = settingsList.start;
    while (removeStart > 0 && source[removeStart - 1] === ' ') removeStart--;
    return { start: removeStart, end: settingsList.end, newText: '' };
  }

  // Multiple settings - remove the setting and its separator.
  const settingNode = elements[settingIndex];
  if (settingIndex === 0) {
    const nextSetting = elements[settingIndex + 1];
    return { start: settingNode.start, end: nextSetting.start, newText: '' };
  }

  const prevSetting = elements[settingIndex - 1];
  return { start: prevSetting.end, end: settingNode.end, newText: '' };
}

// Find the setting node for a declaration node (field/element)
function findSetting (source: string, declaration: SyntaxNode, settingName: string): {
  settingsList: ListExpressionNode;
  settingNode: AttributeNode;
  settingIndex: number;
} | undefined {
  if (!(declaration instanceof FunctionApplicationNode) && !(declaration instanceof ElementDeclarationNode)) return undefined;
  const settingsList = declaration instanceof FunctionApplicationNode ? declaration.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode) : declaration.attributeList;
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
