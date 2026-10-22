import type Compiler from '@/compiler';
import { type Filepath } from '@/core/types';
import { CompileError } from '@/core/types/errors';
import type { MetadataElementMetadata } from '@/core/types/symbol/metadata';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { CustomMetadata } from '@/core/types/schemaJson';
import { extractMetadataValue, getTokenPosition } from '@/core/utils/interpret';
import { getMetadataTargetKind } from '@/core/local_modules/metadata/utils';
import { METADATA_FIELDS_BY_KIND } from './registries';

export default class MetadataInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private filepath: Filepath;
  private values: CustomMetadata;

  constructor (compiler: Compiler, metadata: MetadataElementMetadata, filepath: Filepath) {
    this.compiler = compiler;
    this.declarationNode = metadata.declaration;
    this.filepath = filepath;
    this.values = {};
  }

  // Interpret a single metadata block body into its parsed key/value entries, builtin fields included
  // target is resolved separately via the resolution index
  interpret (): Report<CustomMetadata> {
    const errors = this.interpretValues(this.declarationNode.body);
    return new Report(this.values, errors);
  }

  private interpretValues (body?: BlockExpressionNode | FunctionApplicationNode): CompileError[] {
    if (!(body instanceof BlockExpressionNode)) return [];

    // The header's target kind fixes which builtin fields apply, so every value is parsed here
    const targetKind = getMetadataTargetKind(this.declarationNode);
    const registry = targetKind ? METADATA_FIELDS_BY_KIND[targetKind] : {};

    for (const stmt of body.body) {
      if (!(stmt instanceof ElementDeclarationNode)) continue;
      const key = stmt.type?.value;
      if (!key) continue;

      const valueNode = stmt.body instanceof FunctionApplicationNode
        ? stmt.body.callee
        : undefined;

      if (!valueNode) continue;

      // An invalid value is dropped so it never overrides a valid one when blocks are merged
      const field = registry[key.toLowerCase()];
      const token = getTokenPosition(stmt);
      if (field) {
        const value = field.parse(valueNode);
        if (value !== undefined) this.values[key] = { value, type: field.type, token };
        continue;
      }

      const parsed = extractMetadataValue(valueNode);
      if (parsed) this.values[key] = { ...parsed, token };
    }

    return [];
  }
}
