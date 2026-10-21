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
import type { MetadataValues } from '@/core/types/schemaJson';
import { getTokenPosition } from '@/core/utils/interpret';

export default class MetadataInterpreter {
  private declarationNode: ElementDeclarationNode;
  private compiler: Compiler;
  private filepath: Filepath;
  private values: MetadataValues;

  constructor (compiler: Compiler, metadata: MetadataElementMetadata, filepath: Filepath) {
    this.compiler = compiler;
    this.declarationNode = metadata.declaration;
    this.filepath = filepath;
    this.values = {};
  }

  // Interpret a single metadata block body into its key/value-node pairs
  // target is resolved separately via the resolution index
  interpret (): Report<MetadataValues> {
    const errors = this.interpretValues(this.declarationNode.body);
    return new Report(this.values, errors);
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

      if (!valueNode) continue;

      // Values are parsed when attached, once the target's builtin fields are known
      this.values[key] = {
        node: valueNode,
        token: getTokenPosition(stmt),
      };
    }

    return [];
  }
}
