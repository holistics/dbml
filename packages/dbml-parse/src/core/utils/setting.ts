import {
  FunctionApplicationNode, ListExpressionNode, AttributeNode, ElementDeclarationNode,
} from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import type { TextEdit } from '@/compiler/queries/transform/applyTextEdits';
import { extractSettingName } from './expression';
import { hasSimpleBody } from './validate';

// The form a setting appears in
export type SettingLocation =
  // [key: value] inside a [...] attribute list
  | {
    kind: 'attribute';
    settingsList: ListExpressionNode;
    settingNode: AttributeNode;
    settingIndex: number;
  }
  // key: value as a body sub-declaration (short form)
  | {
    kind: 'body';
    declaration: ElementDeclarationNode;
  }
  // not found
  | undefined;

// Locates a setting on a declaration node and returns its form
export function findSetting (declaration: SyntaxNode, settingName: string): SettingLocation {
  // check [...] attribute list
  const settingsList = findSettingsList(declaration);
  if (settingsList) {
    const elements = settingsList.elementList ?? [];

    const settingIndex = elements.findIndex((element) => {
      if (!(element instanceof AttributeNode)) return false;
      return extractSettingName(element)?.toLowerCase() === settingName.toLowerCase();
    });

    if (settingIndex !== -1) {
      return {
        kind: 'attribute',
        settingsList,
        settingNode: elements[settingIndex] as AttributeNode,
        settingIndex,
      };
    }
  }

  if (declaration instanceof ElementDeclarationNode) {
  // check body sub-declaration (e.g. `color: #hex` or `note { 'text' }`)
    const sub = findBodySetting(declaration, settingName);
    if (sub) {
      return { kind: 'body', declaration: sub };
    }
  }

  return undefined;
}

// Adds a setting to a declaration that doesn't have it yet.
// If the declaration has a [...] list, appends to it.
// Otherwise inserts a new [...] block.
export function addSettingEdit (declaration: SyntaxNode, setting: string): TextEdit | undefined {
  const settingsList = findSettingsList(declaration);
  if (settingsList) {
    const insertOffset = settingsList.end - 1;
    return { start: insertOffset, end: insertOffset, newText: `, ${setting}` };
  }

  // for block-form elements, insert [setting] before the body {
  if (declaration instanceof ElementDeclarationNode) {
    const body = declaration.body;
    if (body && !(body instanceof FunctionApplicationNode)) {
      return { start: body.start, end: body.start, newText: `[${setting}] ` };
    }
  }

  return { start: declaration.end, end: declaration.end, newText: ` [${setting}]` };
}

// Updates, creates, or removes a setting on a declaration.
// - value: string -> update or create with "name: value"
// - value: undefined -> name-only setting (e.g. [pk])
// - value: null -> remove the setting
// If the setting does not exist, adds it.
export function updateSettingEdit (
  declaration: SyntaxNode,
  settingName: string,
  value: string | null | undefined,
  source: string,
): TextEdit | undefined {
  if (value === null) {
    return removeSettingEdit(declaration, settingName, source);
  }

  // "name: value" or just "name" for name-only
  const settingText = value !== undefined
    ? `${settingName}: ${value}`
    : settingName;

  const located = findSetting(declaration, settingName);
  if (located) {
    const node = located.kind === 'attribute' ? located.settingNode : located.declaration;
    return { start: node.start, end: node.end, newText: settingText };
  }

  // setting not present - add it
  return addSettingEdit(declaration, settingText);
}

// Removes a setting from a declaration.
// If it's the only setting in a [...] list, removes the entire list.
export function removeSettingEdit (
  declaration: SyntaxNode,
  settingName: string,
  source: string,
): TextEdit | undefined {
  const located = findSetting(declaration, settingName);
  if (!located) return undefined;

  if (located.kind === 'body') {
    return { start: located.declaration.start, end: located.declaration.end, newText: '' };
  }

  // attribute form - handle separator cleanup
  const { settingsList, settingIndex } = located;
  const elements = settingsList.elementList ?? [];

  // only setting - remove the entire [...] block including surrounding whitespace
  if (elements.length === 1) {
    let removeStart = settingsList.start;
    while (removeStart > 0 && source[removeStart - 1] === ' ') removeStart--;
    return { start: removeStart, end: settingsList.end, newText: '' };
  }

  // multiple settings - remove the setting and its separator
  const settingNode = elements[settingIndex];
  if (settingIndex === 0) {
    const nextSetting = elements[settingIndex + 1];
    return { start: settingNode.start, end: nextSetting.start, newText: '' };
  }

  const prevSetting = elements[settingIndex - 1];
  return { start: prevSetting.end, end: settingNode.end, newText: '' };
}

// Finds the [...] attribute list on a declaration or its inline body
function findSettingsList (declaration: SyntaxNode): ListExpressionNode | undefined {
  if (declaration instanceof FunctionApplicationNode) {
    return declaration.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode);
  }
  if (declaration instanceof ElementDeclarationNode) {
    // check header attribute list first, then body's inline settings
    if (declaration.attributeList) return declaration.attributeList;
    const body = declaration.body;
    if (body instanceof FunctionApplicationNode) {
      return body.args.find((a): a is ListExpressionNode => a instanceof ListExpressionNode);
    }
  }
  return undefined;
}

// Find a body sub-declaration by name (e.g. `color: #hex` or `note { 'text' }`)
export function findBodySetting (declaration: ElementDeclarationNode, settingName: string): ElementDeclarationNode | undefined {
  const body = declaration.body;

  if (!body || hasSimpleBody(declaration) || body instanceof FunctionApplicationNode) return undefined;

  for (const child of body.body) {
    if (!(child instanceof ElementDeclarationNode)) continue;
    if (child.type?.value?.toLowerCase() !== settingName.toLowerCase()) continue;
    return child;
  }
  return undefined;
}
