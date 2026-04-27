import type Compiler from '@/compiler';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import type {
  ColumnType, TokenPosition,
} from '@/core/types/schemaJson';
import {
  ArrayNode, CallExpressionNode, FunctionExpressionNode, LiteralNode, PrimaryExpressionNode,
} from '@/core/types/nodes';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import {
  UNHANDLED,
} from '@/core/types/module';
import Report from '@/core/types/report';
import {
  SyntaxTokenKind,
} from '@/core/types/tokens';
import {
  destructureComplexVariable, destructureMemberAccessExpression,
  extractQuotedStringToken, extractVariableFromExpression,
  isDotDelimitedIdentifier, isExpressionAQuotedString, isExpressionAnIdentifierNode,
} from './expression';
import {
  isExpressionASignedNumberExpression,
} from './validate';
import {
  extractNumber,
  getNumberTextFromExpression,
} from './numbers';

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

export function parseElementName (nameNode: SyntaxNode): {
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

export function parseColor (node: unknown): string | undefined {
  if (
    node instanceof PrimaryExpressionNode
    && node.expression instanceof LiteralNode
    && node.expression.literal?.kind === SyntaxTokenKind.COLOR_LITERAL
  ) {
    return node.expression.literal.value;
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
  let numericParams: {
    precision: number;
    scale: number;
  } | undefined;
  let lengthParam: {
    length: number;
  } | undefined;

  if (typeNode instanceof CallExpressionNode) {
    const argElements = typeNode.argumentList?.elementList ?? [];
    typeArgs = argElements.map((e) => {
      if (isExpressionASignedNumberExpression(e)) return getNumberTextFromExpression(e);
      if (isExpressionAQuotedString(e)) return extractQuotedStringToken(e);
      return extractVariableFromExpression(e);
    }).join(',');
    typeSuffix = `(${typeArgs})`;

    if (argElements.length === 2
      && isExpressionASignedNumberExpression(argElements[0])
      && isExpressionASignedNumberExpression(argElements[1])) {
      const precision = extractNumber(argElements[0]);
      const scale = extractNumber(argElements[1]);
      if (!Number.isNaN(precision) && !Number.isNaN(scale)) numericParams = {
        precision: Math.trunc(precision),
        scale: Math.trunc(scale),
      };
    } else if (argElements.length === 1 && isExpressionASignedNumberExpression(argElements[0])) {
      const length = extractNumber(argElements[0]);
      if (!Number.isNaN(length)) lengthParam = {
        length: Math.trunc(length),
      };
    }
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
  } = parseElementName(typeNode);
  const isEnum = !!compiler.nodeReferee(typeNode).getFiltered(UNHANDLED);

  if (typeSchemaName.length > 1) {
    return new Report(
      {
        schemaName: typeSchemaName[0] ?? null,
        type_name: `${typeName}${typeSuffix}`,
        args: typeArgs,
        numericParams,
        lengthParam,
        isEnum,
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
    numericParams,
    lengthParam,
    isEnum,
  });
}
