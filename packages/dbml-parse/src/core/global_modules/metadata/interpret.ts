import type Compiler from '@/compiler';
import type { Filepath } from '@/core/types';
import { CompileError } from '@/core/types/errors';
import type { MetadataElementMetadata } from '@/core/types/symbol/metadata';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
  type SyntaxNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import type { MetadataElement } from '@/core/types/schemaJson';
import {
  extractColor,
  getTokenPosition,
} from '@/core/utils/interpret';
import {
  destructureComplexVariable,
  extractNumericLiteral,
  extractQuotedStringToken,
  extractVariableFromExpression,
} from '@/core/utils/expression';
import { getElementSubKind } from '@/core/utils/validate';

// Best-effort scalar extraction for a free-form metadata value node.
// Tries: quoted string -> number -> boolean/identifier -> color -> raw text.
function extractValue (node?: SyntaxNode): unknown {
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

    return Report.create(this.metadata as MetadataElement, errors);
  }

  private interpretTarget (): CompileError[] {
    const kind = getElementSubKind(this.declarationNode.getElementKind(), this.declarationNode.subKind) ?? '';
    // const isColumn = kind === MetadataTargetKind.Column;

    // The header name encodes the target identity directly:
    //   column: [schema?, table, column]   other: [schema?, name]
    const name = destructureComplexVariable(this.declarationNode.name) ?? [];
    // switch (kind) {
    //   case MetadataTargetKind.Column:
    //     if (name.length >= 3 && name[0] === DEFAULT_SCHEMA_NAME) name.shift();
    //     break;
    //   case '':
    //   case MetadataTargetKind.Table:
    //   case MetadataTargetKind.Schema:
    //   case MetadataTargetKind.TableGroup:
    //   case MetadataTargetKind.Ref:
    //   case MetadataTargetKind.Note:
    //   default:
    //     break;
    // }
    // const columnName = isColumn ? (parts.at(-1) ?? null) : undefined;
    // const nameParts = isColumn ? parts.slice(0, -1) : parts;
    // const name = nameParts.at(-1) ?? this.symbol.name ?? '';
    // const schemaName = nameParts.length > 1 ? nameParts.slice(0, -1).join('.') : null;

    this.metadata.target = {
      kind,
      // schemaName: schemaName === DEFAULT_SCHEMA_NAME ? null : schemaName,
      name,
      // ...(isColumn ? { columnName } : {}),
    };
    return [];
  }

  private interpretValues (body?: ElementDeclarationNode['body']): CompileError[] {
    if (!(body instanceof BlockExpressionNode)) return [];

    for (const stmt of body.body) {
      if (!(stmt instanceof ElementDeclarationNode)) continue;
      const key = stmt.type?.value;
      if (!key) continue;

      const valueNode = stmt.body instanceof FunctionApplicationNode
        ? stmt.body.callee
        : undefined;
      this.metadata.values![key] = extractValue(valueNode);
    }

    return [];
  }
}
