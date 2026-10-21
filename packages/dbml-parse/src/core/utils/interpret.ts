import type Compiler from '@/compiler';
import { CompileError, CompileErrorCode } from '@/core/types/errors';
import type {
  Color, ColumnType, CustomMetadata, CustomMetadataValue, TokenPosition,
} from '@/core/types/schemaJson';
import { ArrayNode, CallExpressionNode, FunctionExpressionNode } from '@/core/types/nodes';
import type { SyntaxNode } from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  destructureComplexVariable, destructureMemberAccessExpression, extractBooleanLiteral, extractQuotedStringToken, extractSignedNumber, extractVariableFromExpression,
} from './expression';
import {
  isExpressionASignedNumberExpression, isDotDelimitedIdentifier, isExpressionAQuotedString, isExpressionAnIdentifierNode, isValidHexColor,
  Settings,
} from './validate';
import { extractNumber, getNumberTextFromExpression } from './numbers';
import { NONE_COLOR } from '@/constants';
import { SettingName } from '../types';
import type { MetadataFieldRegistry, MetadataTarget } from '@/core/global_modules/metadata/utils';

export function getTokenPosition (node: SyntaxNode): TokenPosition {
  return {
    start: {
      offset: node.startPos.offset,
      line: node.startPos.line + 1,
      column: node.startPos.column + 1,
    },
    end: {
      offset: node.endPos.offset,
      line: node.endPos.line + 1,
      column: node.endPos.column + 1,
    },
    filepath: node.filepath,
  };
}

export function normalizeNote (content: string): string {
  const lines = content.split('\n');
  const trimmedTopEmptyLines = lines.slice(lines.findIndex((line) => line.trimStart() !== ''));
  const nonEmptyLines = trimmedTopEmptyLines.filter((line) => line.trimStart());
  if (nonEmptyLines.length === 0) return trimmedTopEmptyLines.join('\n');
  const minIndent = Math.min(...nonEmptyLines.map((line) => line.length - line.trimStart().length));
  return trimmedTopEmptyLines.map((line) => line.slice(minIndent)).join('\n');
}

export function extractElementName (nameNode: SyntaxNode): {
  schemaName: string[];
  name: string;
} {
  const fragments = destructureComplexVariable(nameNode);
  if (!fragments || fragments.length === 0) {
    return {
      schemaName: [],
      name: '',
    };
  }
  const name = fragments[fragments.length - 1];
  return {
    name,
    schemaName: fragments.slice(0, -1),
  };
}

// A quoted string normalized as note content
export function extractNote (node?: SyntaxNode): string | undefined {
  const content = extractQuotedStringToken(node);
  return content === undefined ? undefined : normalizeNote(content);
}

export function extractHexColor (node?: SyntaxNode): Color | undefined {
  return isValidHexColor(node) ? node.expression.literal.value as Color : undefined;
}

export function extractColor (node?: SyntaxNode): Color | undefined {
  if (isValidHexColor(node)) return node.expression.literal.value as Color;

  // Support `color: none` as transparent
  if (isExpressionAnIdentifierNode(node)) {
    const value = extractVariableFromExpression(node);
    if (value?.toLowerCase() === NONE_COLOR) return NONE_COLOR;
  }
  return undefined;
}

export function processDefaultValue (valueNode?: SyntaxNode): {
  type: 'number' | 'string' | 'boolean' | 'expression';
  value: string | number;
} | undefined {
  if (!valueNode) return undefined;
  if (isExpressionAQuotedString(valueNode)) {
    const str = extractQuotedStringToken(valueNode);
    if (str !== undefined) return {
      value: str,
      type: 'string',
    };
  }
  if (isExpressionASignedNumberExpression(valueNode)) return {
    type: 'number',
    value: extractNumber(valueNode),
  };
  if (isExpressionAnIdentifierNode(valueNode)) return {
    value: valueNode.expression.variable.value.toLowerCase(),
    type: 'boolean',
  };
  if (valueNode instanceof FunctionExpressionNode && valueNode.value) return {
    value: valueNode.value.value,
    type: 'expression',
  };
  if (isDotDelimitedIdentifier(valueNode)) {
    const fragments = destructureMemberAccessExpression(valueNode);
    const last = fragments?.at(-1);
    const val = last ? extractVariableFromExpression(last) : undefined;
    if (val !== undefined) return {
      value: val,
      type: 'string',
    };
  }
  return undefined;
}

export function processColumnType (
  compiler: Compiler,
  typeNode: SyntaxNode,
): Report<ColumnType> {
  let typeSuffix = '';
  let typeArgs: string | null = null;

  if (typeNode instanceof CallExpressionNode) {
    const argElements = typeNode.argumentList?.elementList ?? [];
    typeArgs = argElements.map((e) => {
      if (isExpressionASignedNumberExpression(e)) return getNumberTextFromExpression(e);
      if (isExpressionAQuotedString(e)) return extractQuotedStringToken(e);
      return extractVariableFromExpression(e);
    }).join(',');
    typeSuffix = `(${typeArgs})`;

    if (!typeNode.callee) return new Report({
      schemaName: null,
      type_name: '',
      args: typeArgs,
    });
    typeNode = typeNode.callee;
  }

  while (typeNode instanceof CallExpressionNode || typeNode instanceof ArrayNode) {
    if (typeNode instanceof CallExpressionNode) {
      const args = (typeNode.argumentList?.elementList ?? []).map((e) => {
        if (isExpressionASignedNumberExpression(e)) return getNumberTextFromExpression(e);
        if (isExpressionAQuotedString(e)) return extractQuotedStringToken(e);
        return extractVariableFromExpression(e);
      }).join(',');
      typeSuffix = `(${args})${typeSuffix}`;
      if (!typeNode.callee) break;
      typeNode = typeNode.callee;
    } else if (typeNode instanceof ArrayNode) {
      const indexer = `[${(typeNode.indexer?.elementList ?? []).map((e: any) => e?.name?.expression?.literal?.value ?? '').join(',')}]`;
      typeSuffix = `${indexer}${typeSuffix}`;
      if (!typeNode.array) break;
      typeNode = typeNode.array;
    }
  }

  const {
    name: typeName, schemaName: typeSchemaName,
  } = extractElementName(typeNode);
  if (typeSchemaName.length > 1) {
    return new Report(
      {
        schemaName: typeSchemaName[0] ?? null,
        type_name: `${typeName}${typeSuffix}`,
        args: typeArgs,
      },
      [
        new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', typeNode),
      ],
    );
  }

  return new Report({
    schemaName: typeSchemaName.length === 0 ? null : typeSchemaName[0],
    type_name: `${typeName}${typeSuffix}`,
    args: typeArgs,
  });
}

/**
  * Extract inline custom metadata from an aggregated setting list, excluding the given recognized settings.
  * Used for columns, whose recognized settings (pk, ref, note, .etc) are interpreted by the column symbol rather than field specs.
  *
  * NOTE: This is used during interpret phase, so no need to validate values, just extract them
  */
export function extractCustomInlineMetadata (settingMap: Settings, builtinSettings: readonly SettingName[]): CustomMetadata {
  const builtins = new Set(builtinSettings.map((n) => n.toLowerCase()));
  const values: CustomMetadata = {};

  for (const [name, attrs] of Object.entries(settingMap)) {
    if (builtins.has(name.toLowerCase())) continue;
    const attr = attrs[0];
    const value = extractMetadataValue(attr.value);
    if (value !== undefined) values[name] = value;
  }

  return values;
}

/**
  * Interpret an element's aggregated setting list as metadata:
  * - Builtin fields (headercolor and note in `table`, color in `tablegroup`, .etc) are parsed and assigned onto the element by their field spec
  * - Every other key becomes free-form custom metadata on `element.metadata`
  *
  * Invalid values are skipped (reported at validate phase).
  */
export function assignInlineMetadata<T extends MetadataTarget> (
  element: Partial<T>,
  settingMap: Settings,
  registry: MetadataFieldRegistry<T, any>,
): void {
  const metadata: CustomMetadata = {};

  for (const [name, attrs] of Object.entries(settingMap)) {
    const attr = attrs[0];
    const field = registry[name];
    if (field) {
      const value = field.parse(attr.value);
      if (value !== undefined) field.assign(element, value, getTokenPosition(attr));
      continue;
    }

    const value = extractMetadataValue(attr.value);
    if (value !== undefined) metadata[name] = value;
  }

  element.metadata = metadata;
}

// Best-effort scalar extraction for a free-form metadata value node.
// Tries: boolean -> signed number -> quoted string -> color.
export function extractMetadataValue (node?: SyntaxNode): CustomMetadataValue | undefined {
  if (!node) return undefined;

  const boolean = extractBooleanLiteral(node);
  if (boolean !== null) return boolean;

  const number = extractSignedNumber(node);
  if (number !== null) return number;

  const quoted = extractQuotedStringToken(node);
  if (quoted !== undefined) return quoted;

  const color = extractColor(node);
  if (color !== undefined) return color;

  return undefined;
}
