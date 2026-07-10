/**
 * General-purpose setting edit utilities for any element declaration.
 * Produces TextEdits for adding, updating, and removing settings in [...] blocks.
 */

import {
  FunctionApplicationNode, ListExpressionNode, AttributeNode, ElementDeclarationNode,
  IdentifierStreamNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { TextEdit } from '@/compiler/queries/transform/applyTextEdits';
import { extractStringFromIdentifierStream } from '@/core/utils/expression';

/**
 * Produces a TextEdit that adds a setting to a field/element declaration.
 * If the declaration already has a settings block [...], inserts before the closing ].
 * Otherwise, appends a new [setting] block.
 */
export function addSettingEdit (declaration: SyntaxNode, setting: string): TextEdit | undefined {
  const settingsList = findSettingsList(declaration);
  if (settingsList) {
    const insertOffset = settingsList.end - 1;
    return { start: insertOffset, end: insertOffset, newText: `, ${setting}` };
  }

  // For block-form elements, insert `[setting]` before the body `{`
  if (declaration instanceof ElementDeclarationNode) {
    const body = declaration.body;
    if (body && !(body instanceof FunctionApplicationNode)) {
      return { start: body.start, end: body.start, newText: `[${setting}] ` };
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
  const found = findSetting(declaration, settingName);
  if (found) {
    return { start: found.settingNode.start, end: found.settingNode.end, newText: newValue };
  }

  // Fall back to body sub-declaration (e.g. `color: #hex` as a body statement)
  const sub = findBodySubDeclaration(declaration, settingName);
  if (sub) {
    return { start: sub.start, end: sub.end, newText: newValue };
  }

  return undefined;
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
  const found = findSetting(declaration, settingName);
  if (found) {
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

  // Fall back to body sub-declaration
  const sub = findBodySubDeclaration(declaration, settingName);
  if (sub) {
    return { start: sub.start, end: sub.end, newText: '' };
  }

  return undefined;
}

// Private helpers

function findSettingsList (declaration: SyntaxNode): ListExpressionNode | undefined {
  if (declaration instanceof FunctionApplicationNode) {
    return declaration.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode);
  }
  if (declaration instanceof ElementDeclarationNode) {
    // Check header attribute list first, then body's inline settings
    if (declaration.attributeList) return declaration.attributeList;
    const body = declaration.body;
    if (body instanceof FunctionApplicationNode) {
      return body.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode);
    }
  }
  return undefined;
}

function attrName (attr: AttributeNode): string | undefined {
  if (attr.name instanceof IdentifierStreamNode) {
    return extractStringFromIdentifierStream(attr.name)?.toLowerCase();
  }
  return undefined;
}

function findSetting (declaration: SyntaxNode, settingName: string): {
  settingsList: ListExpressionNode;
  settingNode: AttributeNode;
  settingIndex: number;
} | undefined {
  const settingsList = findSettingsList(declaration);
  if (!settingsList) return undefined;

  const lowerName = settingName.toLowerCase();
  const elements = settingsList.elementList ?? [];
  const settingIndex = elements.findIndex((el) => {
    if (!(el instanceof AttributeNode)) return false;
    return attrName(el) === lowerName;
  });
  if (settingIndex === -1) return undefined;

  return { settingsList, settingNode: elements[settingIndex] as AttributeNode, settingIndex };
}

/** Find a body sub-declaration by name (e.g. `color: #hex` as a body statement). */
function findBodySubDeclaration (declaration: SyntaxNode, settingName: string): ElementDeclarationNode | undefined {
  if (!(declaration instanceof ElementDeclarationNode)) return undefined;
  const body = declaration.body;
  if (!body || body instanceof FunctionApplicationNode) return undefined;

  for (const child of body.body) {
    if (!(child instanceof ElementDeclarationNode)) continue;
    if (child.type?.value?.toLowerCase() !== settingName.toLowerCase()) continue;
    if (child.body instanceof FunctionApplicationNode && child.body.callee) return child;
  }
  return undefined;
}
