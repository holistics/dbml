import type Compiler from '@/compiler';
import { SettingName, type Filepath } from '@/core/types';
import { CompileError } from '@/core/types/errors';
import type { MetadataElementMetadata } from '@/core/types/symbol/metadata';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  MetadataDeclarationNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { MetadataElement } from '@/core/types/schemaJson';
import { getTokenPosition, normalizeNote } from '@/core/utils/interpret';
import { destructureComplexVariable } from '@/core/utils/expression';
import { extractMetadataValue } from '../../utils/interpret';

// Per-element-kind typed builtin setting names (lowercased). A setting-list key
// in one of these sets is the typed builtin and is NOT custom metadata; every
// other key is harvested as inline custom metadata. These are explicit
// allowlists (not derived from the validators) so the two stay independently
// auditable. Mirrors the SettingName enum values.
export const TABLE_BUILTIN_SETTINGS: readonly SettingName[] = [
  SettingName.HeaderColor,
  SettingName.Note,
];

export const TABLEGROUP_BUILTIN_SETTINGS: readonly SettingName[] = [
  SettingName.Color,
  SettingName.Note,
];

export const NOTE_BUILTIN_SETTINGS: readonly SettingName[] = [
  SettingName.Color,
];

export const COLUMN_BUILTIN_SETTINGS: readonly SettingName[] = [
  SettingName.PK,
  SettingName.PrimaryKey,
  SettingName.Unique,
  SettingName.Note,
  SettingName.Ref,
  SettingName.Default,
  SettingName.Check,
  SettingName.Increment,
  SettingName.NotNull,
  SettingName.Null,
];

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
    const kind = this.declarationNode.getTargetKind();

    if (!kind) return [];

    // The header name encodes the target identity directly:
    //   column: [column, table, schema?]   other: [name, schema?]
    const name = destructureComplexVariable(this.declarationNode.targetName) ?? [];

    this.metadata.target = { kind, name };
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

      const value = extractMetadataValue(valueNode);
      if (value) {
        this.metadata.values![key] = key === 'note' ? normalizeNote(value) : value;
        this.metadata.valueTokens![key] = getTokenPosition(stmt);
      }
    }

    return [];
  }
}
