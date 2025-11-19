import { last, zip } from 'lodash-es';
import { ColumnSymbol } from '@/core/analyzer/symbol/symbols';
import {
  destructureComplexTuple, destructureComplexVariable, destructureMemberAccessExpression, extractQuotedStringToken,
  extractVariableFromExpression,
} from '@/core/analyzer/utils';
import {
  ArrayNode, CallExpressionNode, FunctionExpressionNode, LiteralNode,
  PrimaryExpressionNode, SyntaxNode, TupleExpressionNode,
} from '@/core/parser/nodes';
import {
  ColumnType, RelationCardinality, Table, TokenPosition,
} from '@/core/interpreter/types';
import { SyntaxTokenKind } from '@/core/lexer/tokens';
import { isDotDelimitedIdentifier, isExpressionAnIdentifierNode, isExpressionAQuotedString } from '@/core/parser/utils';
import { isExpressionANumber } from '@/core/analyzer/validator/utils';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { getNumberTextFromExpression, parseNumber } from '@/core/utils';

export function extractNamesFromRefOperand (operand: SyntaxNode, owner?: Table): { schemaName: string | null; tableName: string; fieldNames: string[] } {
  const { variables, tupleElements } = destructureComplexTuple(operand).unwrap();

  if (tupleElements) {
    if (variables.length === 0) {
      return {
        schemaName: owner!.schemaName,
        tableName: owner!.name,
        fieldNames: tupleElements,
      };
    }
    return {
      tableName: variables.pop()!,
      schemaName: variables.pop() || null,
      fieldNames: tupleElements,
    };
  }

  if (variables.length === 1) {
    return {
      schemaName: owner!.schemaName,
      tableName: owner!.name,
      fieldNames: [variables[0]],
    };
  }

  return {
    fieldNames: [variables.pop()!],
    tableName: variables.pop()!,
    schemaName: variables.pop() || null,
  };
}

export function getMultiplicities (
  op: string,
): [RelationCardinality, RelationCardinality] {
  switch (op) {
    case '<':
      return ['1', '*'];
    case '<>':
      return ['*', '*'];
    case '>':
      return ['*', '1'];
    case '-':
      return ['1', '1'];
    default:
      throw new Error('Invalid relation op');
  }
}

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
  };
}

export function getColumnSymbolsOfRefOperand (ref: SyntaxNode): ColumnSymbol[] {
  const colNode = destructureMemberAccessExpression(ref).unwrap_or(undefined)?.pop();
  if (colNode instanceof TupleExpressionNode) {
    return colNode.elementList.map((e) => e.referee as ColumnSymbol);
  }
  return [colNode!.referee as ColumnSymbol];
}

export function extractElementName (nameNode: SyntaxNode): { schemaName: string[]; name: string } {
  const fragments = destructureComplexVariable(nameNode).unwrap();
  const name = fragments.pop()!;
  return {
    name,
    schemaName: fragments,
  };
}

export function extractColor (node: PrimaryExpressionNode & { expression: LiteralNode } & { literal: { kind: SyntaxTokenKind.COLOR_LITERAL } }): string {
  return node.expression.literal!.value;
}

export function getRefId (sym1: ColumnSymbol, sym2: ColumnSymbol): string;
export function getRefId (sym1: ColumnSymbol[], sym2: ColumnSymbol[]): string;
export function getRefId (sym1: ColumnSymbol | ColumnSymbol[], sym2: ColumnSymbol | ColumnSymbol[]): string {
  if (Array.isArray(sym1)) {
    const firstIds = sym1.map(({ id }) => id).sort().join(',');
    const secondIds = (sym2 as ColumnSymbol[]).map(({ id }) => id).sort().join(',');
    return firstIds < secondIds ? `${firstIds}-${secondIds}` : `${secondIds}-${firstIds}`;
  }

  const firstId = sym1.id.toString();
  const secondId = (sym2 as ColumnSymbol).id.toString();
  return firstId < secondId ? `${firstId}-${secondId}` : `${secondId}-${firstId}`;
}

export function isSameEndpoint (sym1: ColumnSymbol, sym2: ColumnSymbol): boolean;
export function isSameEndpoint (sym1: ColumnSymbol[], sym2: ColumnSymbol[]): boolean;
export function isSameEndpoint (sym1: ColumnSymbol | ColumnSymbol[], sym2: ColumnSymbol | ColumnSymbol[]): boolean {
  if (Array.isArray(sym1)) {
    const firstIds = sym1.map(({ id }) => id).sort();
    const secondIds = (sym2 as ColumnSymbol[]).map(({ id }) => id).sort();
    return zip(firstIds, secondIds).every(([first, second]) => first === second);
  }

  const firstId = sym1.id;
  const secondId = (sym2 as ColumnSymbol).id;
  return firstId === secondId;
}

export function normalizeNoteContent (content: string): string {
  const lines = content.split('\n');

  // Top empty lines are trimmed
  const trimmedTopEmptyLines = lines.slice(lines.findIndex((line) => line.trimStart() !== ''));

  // Calculate min-indentation, empty lines are ignored
  const nonEmptyLines = trimmedTopEmptyLines.filter((line) => line.trimStart());
  const minIndent = Math.min(...nonEmptyLines.map((line) => line.length - line.trimStart().length));

  return trimmedTopEmptyLines.map((line) => line.slice(minIndent)).join('\n');
}

export function processDefaultValue (valueNode?: SyntaxNode):
  {
    type: 'string' | 'number' | 'boolean' | 'expression';
    value: string | number;
  } | undefined {
  if (!valueNode) {
    return undefined;
  }

  if (isExpressionAQuotedString(valueNode)) {
    return {
      value: extractQuotedStringToken(valueNode).unwrap(),
      type: 'string',
    };
  }

  if (isExpressionANumber(valueNode)) {
    return {
      type: 'number',
      value: parseNumber(valueNode),
    };
  }

  if (isExpressionAnIdentifierNode(valueNode)) {
    const value = valueNode.expression.variable.value.toLowerCase();
    return {
      value,
      type: 'boolean',
    };
  }

  if (valueNode instanceof FunctionExpressionNode && valueNode.value) {
    return {
      value: valueNode.value.value,
      type: 'expression',
    };
  }

  if (isDotDelimitedIdentifier(valueNode)) {
    return {
      value: destructureMemberAccessExpression(valueNode).map(last).and_then(extractVariableFromExpression).unwrap(),
      type: 'string',
    };
  }

  throw new Error('Unreachable');
}

export function processColumnType (typeNode: SyntaxNode): Report<ColumnType, CompileError> {
  let typeSuffix: string = '';
  let typeArgs: string | null = null;
  if (typeNode instanceof CallExpressionNode) {
    typeArgs = typeNode
      .argumentList!.elementList.map((e) => {
      if (isExpressionANumber(e)) {
        return getNumberTextFromExpression(e);
      }
      if (isExpressionAQuotedString(e)) {
        return extractQuotedStringToken(e).unwrap();
      }
      // e can only be an identifier here
      return extractVariableFromExpression(e).unwrap();
    })
      .join(',');
    typeSuffix = `(${typeArgs})`;
    typeNode = typeNode.callee!;
  }
  while (typeNode instanceof CallExpressionNode || typeNode instanceof ArrayNode) {
    if (typeNode instanceof CallExpressionNode) {
      const args = typeNode
        .argumentList!.elementList.map((e) => {
        if (isExpressionANumber(e)) {
          return getNumberTextFromExpression(e);
        }
        if (isExpressionAQuotedString(e)) {
          return extractQuotedStringToken(e).unwrap();
        }
        // e can only be an identifier here
        return extractVariableFromExpression(e).unwrap();
      })
        .join(',');
      typeSuffix = `(${args})${typeSuffix}`;
      typeNode = typeNode.callee!;
    } else if (typeNode instanceof ArrayNode) {
      const indexer = `[${
        typeNode
          .indexer!.elementList.map((e) => (e.name as any).expression.literal.value)
          .join(',')
      }]`;
      typeSuffix = `${indexer}${typeSuffix}`;
      typeNode = typeNode.array!;
    }
  }

  const { name: typeName, schemaName: typeSchemaName } = extractElementName(typeNode);
  if (typeSchemaName.length > 1) {
    return new Report(
      {
        schemaName: typeSchemaName.length === 0 ? null : typeSchemaName[0],
        type_name: `${typeName}${typeSuffix}`,
        args: typeArgs,
      },
      [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', typeNode)],
    );
  }

  return new Report({
    schemaName: typeSchemaName.length === 0 ? null : typeSchemaName[0],
    type_name: `${typeName}${typeSuffix}`,
    args: typeArgs,
  });
}
