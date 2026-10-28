import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { Filepath } from '@/core/types/filepath';
import { SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { applyTextEdits, type TextEdit } from './applyTextEdits';
import { updateSettingEdit } from '@/core/utils/setting';
import type {
  ElementIdentifier, DepIdentifier, RefIdentifier, ArchElementIdentifier, ArchLinkIdentifier,
} from './types';
import {
  lookupElementSymbol,
  formatEndpoint, formatSetting, findRefDefinition, findDepDefinition,
} from './utils';
import {
  findArchElement, findArchLink, fullName, removeAttributeEdit,
} from './utils/arch';
import { localHandle, roleOfSymbol } from '@/core/global_modules/arch/utils';
import { LinkMetadata } from '@/core/types/symbol/metadata';
import { bodyOf, handleOf, linkPartsOf, roleOf } from '@/core/arch/read';
import { FunctionApplicationNode, type PrefixExpressionNode, type SyntaxNode } from '@/core/types/nodes';

export function updateElementSettingEdit (
  this: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
  settingName: string,
  value: string | null | undefined,
): TextEdit[] {
  if (target.kind === 'dep') {
    return updateDepSettingEdit(this, filepath, target, settingName, value);
  }

  if (target.kind === 'ref') {
    return updateRefSettingEdit(this, filepath, target, settingName, value);
  }

  if (target.kind === SymbolKind.Element) {
    return updateArchElementSettingEdit(this, filepath, target, settingName, value);
  }

  if (target.kind === 'Link') {
    return updateArchLinkSettingEdit(this, filepath, target, settingName, value);
  }

  const declaration = findNamedElementDeclaration(this, filepath, target);
  if (!declaration) return [];

  const source = this.getSource(filepath) ?? '';
  const edit = updateSettingEdit(declaration, settingName, value, source);
  return edit
    ? [
        edit,
      ]
    : [];
}

export function updateElementSetting (
  this: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
  settingName: string,
  value: string | null | undefined,
): string {
  const source = this.getSource(filepath) ?? '';
  const edits = this.updateElementSettingEdit(filepath, target, settingName, value);
  if (edits.length === 0) return source;
  return applyTextEdits(source, edits);
}

function findNamedElementDeclaration (compiler: Compiler, filepath: Filepath, target: ElementIdentifier): SyntaxNode | undefined {
  const schema = ('schema' in target ? target.schema : undefined) ?? DEFAULT_SCHEMA_NAME;

  switch (target.kind) {
    case SymbolKind.Column: {
      const tableSymbol = lookupElementSymbol(compiler, filepath, schema, target.table, SymbolKind.Table);
      return tableSymbol ? compiler.lookupMembers(tableSymbol, SymbolKind.Column, target.column)?.declaration : undefined;
    }
    case SymbolKind.Table:
      return lookupElementSymbol(compiler, filepath, schema, target.table)?.declaration;
    case SymbolKind.Enum:
    case SymbolKind.StickyNote:
    case SymbolKind.TableGroup:
      return lookupElementSymbol(compiler, filepath, schema, target.name, target.kind)?.declaration;
    case SymbolKind.Schema:
      return lookupElementSymbol(compiler, filepath, target.schema, '', SymbolKind.Schema)?.declaration;
    default:
      return undefined;
  }
}

function updateDepSettingEdit (compiler: Compiler, filepath: Filepath, target: DepIdentifier, settingName: string, value: string | null | undefined): TextEdit[] {
  const source = compiler.getSource(filepath) ?? '';
  const definition = findDepDefinition(compiler, filepath, target);
  if (!definition) return [];

  if (definition.kind === 'inline') {
    if (value === null) return [];

    const up = formatEndpoint(target.upstream);
    const down = formatEndpoint(target.downstream);
    const setting = formatSetting(settingName, value);

    const depBlock = setting
      ? `Dep [${setting}] {\n  ${up} -> ${down}\n}`
      : `Dep {\n  ${up} -> ${down}\n}`;
    return [
      { start: definition.fullStart, end: definition.fullEnd, newText: '' },
      { start: source.length, end: source.length, newText: '\n\n' + depBlock + '\n' },
    ];
  }

  const { declaration } = definition;
  const { body } = declaration;

  if (body instanceof FunctionApplicationNode) {
    const headerEdit = updateSettingEdit(declaration, settingName, value, source);
    if (headerEdit) return [
      headerEdit,
    ];
    const edgeEdit = updateSettingEdit(body, settingName, value, source);
    if (edgeEdit) return [
      edgeEdit,
    ];
    return [];
  }

  const edit = updateSettingEdit(declaration, settingName, value, source);
  return edit
    ? [
        edit,
      ]
    : [];
}

function updateRefSettingEdit (compiler: Compiler, filepath: Filepath, target: RefIdentifier, settingName: string, value: string | null | undefined): TextEdit[] {
  const source = compiler.getSource(filepath) ?? '';
  const result = findRefDefinition(compiler, filepath, target);

  if (!result) return [];

  if (result.kind === 'inline') {
    if (value === null) return [];
    const left = formatEndpoint(target.endpoints[0]);
    const right = formatEndpoint(target.endpoints[1]);
    const setting = formatSetting(settingName, value);
    const refLine = setting
      ? `Ref: ${left} ${result.op} ${right} [${setting}]`
      : `Ref: ${left} ${result.op} ${right}`;
    return [
      { start: result.fullStart, end: result.fullEnd, newText: '' },
      { start: source.length, end: source.length, newText: '\n\n' + refLine + '\n' },
    ];
  }

  const edit = updateSettingEdit(result.node, settingName, value, source);
  return edit
    ? [
        edit,
      ]
    : [];
}

function updateArchElementSettingEdit (compiler: Compiler, filepath: Filepath, target: ArchElementIdentifier, settingName: string, value: string | null | undefined): TextEdit[] {
  const declaration = findArchElement(compiler, filepath, target.name, target.role);
  if (!declaration) return [];

  const edit = updateSettingEdit(declaration, settingName, value, compiler.getSource(filepath) ?? '');
  return edit
    ? [
        edit,
      ]
    : [];
}

function updateArchLinkSettingEdit (compiler: Compiler, filepath: Filepath, target: ArchLinkIdentifier, settingName: string, value: string | null | undefined): TextEdit[] {
  const source = compiler.getSource(filepath) ?? '';
  const definition = findArchLink(compiler, filepath, target.from, target.to, target.fromRole, target.toRole);
  if (!definition) return [];

  // An inline link has no list of its own, so it moves out to a `Link:` that can carry the setting, as an inline ref does
  if (definition.kind === 'inline') {
    const handle = handleOf(definition.element);
    const role = roleOf(definition.element);
    const target = new LinkMetadata(definition.attribute).endpoints(compiler)[1];
    const targetHandle = target && localHandle(compiler, target, filepath);
    const targetRole = target && roleOfSymbol(target);
    if (value === null || !definition.element.attributeList || handle === undefined || !role || targetHandle === undefined || !targetRole) return [];
    const setting = formatSetting(settingName, value);
    const line = `Link: ${fullName(handle, role)} ${definition.op} ${fullName(targetHandle, targetRole)}`;
    return [
      removeAttributeEdit(definition.element.attributeList, definition.attribute, source),
      { start: source.length, end: source.length, newText: `\n\n${setting ? `${line} [${setting}]` : line}\n` },
    ];
  }

  const { declaration } = definition;
  // The list after `a > b` is read before the header's, so the header is written only when it is the link's only list
  const useHeader = !linkPartsOf(declaration)?.row?.settings && !!declaration.attributeList;
  const node = useHeader ? declaration : bodyOf(declaration)[0];
  const edit = updateSettingEdit(node, settingName, value, compiler.getSource(filepath) ?? '');
  return edit
    ? [
        edit,
      ]
    : [];
}
