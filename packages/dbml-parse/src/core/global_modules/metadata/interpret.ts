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
import type { MetadataElement } from '@/core/types/schemaJson';
import { getTokenPosition, normalizeNote } from '@/core/utils/interpret';
import { destructureComplexVariable } from '@/core/utils/expression';
import { getMetadataTargetKind } from '@/core/local_modules/metadata/utils';
import { extractMetadataValue } from '../../utils/interpret';

export default class MetadataInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private filepath: Filepath;
  private metadata: Partial<MetadataElement>;

  constructor (compiler: Compiler, metadata: MetadataElementMetadata, filepath: Filepath) {
    this.compiler = compiler;
    this.declarationNode = metadata.declaration;
    this.filepath = filepath;
    this.metadata = {
      target: undefined,
      valueWithTokens: {},
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
    const kind = getMetadataTargetKind(this.declarationNode);

    if (!kind) return [];

    // The header name encodes the target identity directly:
    //   column: [column, table, schema?]   other: [name, schema?]
    const name = destructureComplexVariable(this.declarationNode.name) ?? [];

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
      if (!value) continue;

      this.metadata.valueWithTokens![key] = {
        value: key === 'note' ? normalizeNote(value) : value,
        token: getTokenPosition(stmt),
      };
    }

    return [];
  }
}
