import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { Filepath } from '@/core/types/filepath';
import { SymbolKind } from '@/core/types/symbol';
import type Compiler from '../../index';
import { applyTextEdits, type TextEdit } from './applyTextEdits';
import { updateSettingEdit } from '@/core/utils/setting';
import type { ElementIdentifier, DepIdentifier, RefIdentifier } from './types';
import {
  endpointsEqual, endpointMatches, lookupElementSymbol,
  formatEndpoint, formatSetting, findRefDefinition,
} from './utils';
import { depBlocksFromProgram, inlineDepsFromProgram } from './syncDep';
import { FunctionApplicationNode, type SyntaxNode } from '@/core/types/nodes';

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
  const program = compiler.parseFile(filepath).getValue().ast;
  const block = depBlocksFromProgram(program).find((b) =>
    b.edges.some((e) => endpointsEqual(e.upstream, target.upstream) && endpointsEqual(e.downstream, target.downstream)),
  );

  if (!block) {
    if (value === null) return [];

    const inline = inlineDepsFromProgram(source, program).find((d) =>
      endpointMatches(d.edge.upstream, target.upstream) && endpointMatches(d.edge.downstream, target.downstream),
    );
    if (!inline) return [];

    const up = formatEndpoint(target.upstream);
    const down = formatEndpoint(target.downstream);
    const setting = formatSetting(settingName, value);

    const depBlock = setting
      ? `Dep [${setting}] {\n  ${up} -> ${down}\n}`
      : `Dep {\n  ${up} -> ${down}\n}`;
    return [
      { start: inline.stripStart, end: inline.stripEnd, newText: '' },
      { start: source.length, end: source.length, newText: '\n\n' + depBlock + '\n' },
    ];
  }

  const { declaration } = block;
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
