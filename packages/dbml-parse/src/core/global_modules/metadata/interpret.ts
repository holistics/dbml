import type Compiler from '@/compiler';
import type { Filepath } from '@/core/types';
import { CompileError } from '@/core/types/errors';
import type { MetadataElementMetadata } from '@/core/types/symbol/metadata';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  MetadataDeclarationNode,
  SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { Color, CustomMetadata, MetadataElement } from '@/core/types/schemaJson';
import type { Settings } from '@/core/utils/validate';
import { extractColor, getTokenPosition, normalizeNote } from '@/core/utils/interpret';
import {
  destructureComplexVariable,
  extractNumericLiteral,
  extractQuotedStringToken,
  extractVariableFromExpression,
} from '@/core/utils/expression';

// Best-effort scalar extraction for a free-form metadata value node.
// Tries: quoted string -> number -> boolean/identifier -> color -> raw text.
export function extractValue (node?: SyntaxNode): string | number | boolean | Color | undefined {
  if (!node) return undefined;

  const quoted = extractQuotedStringToken(node);
  if (quoted !== undefined) return quoted;

  const numeric = extractNumericLiteral(node);
  if (numeric !== null) return numeric;

  const ident = extractVariableFromExpression(node);
  if (ident !== undefined) {
    if (ident === 'true') return true;
    if (ident === 'false') return false;
    return ident;
  }

  const color = extractColor(node);
  if (color !== undefined) return color;

  return undefined;
}

// Per-element-kind typed builtin setting names (lowercased). A setting-list key
// in one of these sets is the typed builtin and is NOT custom metadata; every
// other key is harvested as inline custom metadata. These are explicit
// allowlists (not derived from the validators) so the two stay independently
// auditable. Mirrors the SettingName enum values.
export const TABLE_BUILTIN_SETTINGS = [
  'headercolor',
  'note',
] as const;

export const TABLEGROUP_BUILTIN_SETTINGS = [
  'color',
  'note',
] as const;

export const NOTE_BUILTIN_SETTINGS = [
  'color',
] as const;

export const COLUMN_BUILTIN_SETTINGS = [
  'pk',
  'primary key',
  'unique',
  'note',
  'ref',
  'default',
  'check',
  'increment',
  'not null',
  'null',
] as const;

// Harvest inline custom metadata from an aggregated setting list. Every key NOT
// in `builtinSettingNames` (the element kind's typed builtins, lowercased) is
// treated as free-form custom metadata. Duplicate and invalid-value keys are
// already rejected at validate time, so here we take the first attribute and
// best-effort extract its scalar value. Keys whose value cannot be extracted as
// a scalar (or are valueless) are skipped — validation has already flagged them.
//
// Returns only `values`; inline custom keys never overlap-promote and the
// emitted element types have no slot for per-key tokens, so no tokens are kept.
export function extractInlineMetadata (
  settingMap: Settings,
  builtinSettingNames: readonly string[],
): CustomMetadata {
  const builtins = new Set(builtinSettingNames.map((n) => n.toLowerCase()));
  const values: CustomMetadata = {};

  for (const [
    name,
    attrs,
  ] of Object.entries(settingMap)) {
    if (builtins.has(name.toLowerCase())) continue;
    const attr = attrs[0];
    if (!attr?.value) continue;
    const value = extractValue(attr.value);
    if (value === undefined) continue;
    values[name] = value;
  }

  return values;
}

export default class MetadataInterpreter {
  private declarationNode: MetadataDeclarationNode;
  private compiler: Compiler;
  private filepath: Filepath;
  private metadata: Partial<MetadataElement>;

  constructor (compiler: Compiler, metadata: MetadataElementMetadata, filepath: Filepath) {
    this.compiler = compiler;
    this.declarationNode = metadata.declaration;
    this.filepath = filepath;
    this.metadata = {
      target: undefined,
      values: {},
      valueTokens: {},
      token: undefined,
    };
  }

  interpret (): Report<MetadataElement> {
    this.metadata.token = getTokenPosition(this.declarationNode);

    const errors = [
      ...this.interpretTarget(),
      ...this.interpretValues(this.declarationNode.body),
    ];

    return new Report(this.metadata as MetadataElement, errors);
  }

  private interpretTarget (): CompileError[] {
    const kind = this.declarationNode.getTargetKind() ?? '';

    // The header name encodes the target identity directly:
    //   column: [column, table, schema?]   other: [name, schema?]
    const name = destructureComplexVariable(this.declarationNode.targetName) ?? [];

    this.metadata.target = {
      kind,
      name,
    };
    return [];
  }

  private interpretValues (body?: BlockExpressionNode | FunctionApplicationNode): CompileError[] {
    if (!(body instanceof BlockExpressionNode)) return [];

    for (const stmt of body.body) {
      if (!(stmt instanceof ElementDeclarationNode)) continue;
      const key = stmt.type?.value;
      if (!key) continue;

      const valueNode = stmt.body instanceof FunctionApplicationNode
        ? stmt.body.callee
        : undefined;

      const value = extractValue(valueNode);
      this.metadata.values![key] = key === 'note' && typeof value === 'string'
        ? normalizeNote(value)
        : value;
      this.metadata.valueTokens![key] = getTokenPosition(stmt);
    }

    return [];
  }
}
