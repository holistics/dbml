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
import type { Color, MetadataElement } from '@/core/types/schemaJson';
import { extractColor, getTokenPosition, normalizeNote } from '@/core/utils/interpret';
import {
  destructureComplexVariable,
  extractNumericLiteral,
  extractQuotedStringToken,
  extractVariableFromExpression,
} from '@/core/utils/expression';

// Best-effort scalar extraction for a free-form metadata value node.
// Tries: quoted string -> number -> boolean/identifier -> color -> raw text.
function extractValue (node?: SyntaxNode): string | number | boolean | Color | undefined {
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

  const color = extractColor(node as any);
  if (color !== undefined) return color;

  return undefined;
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
    }

    return [];
  }
}
