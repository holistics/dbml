import { last, zip, uniqBy } from 'lodash-es';
import { ColumnSymbol } from '@/core/analyzer/symbol/symbols';
import {
  destructureComplexVariableTuple, destructureComplexVariable, destructureMemberAccessExpression, extractQuotedStringToken,
  extractVariableFromExpression,
  extractVarNameFromPrimaryVariable,
} from '@/core/analyzer/utils';
import {
  ArrayNode, BlockExpressionNode, CallExpressionNode, FunctionExpressionNode, FunctionApplicationNode, LiteralNode,
  PrimaryExpressionNode, SyntaxNode, TupleExpressionNode,
} from '@/core/parser/nodes';
import {
  ColumnType, RelationCardinality, Table, TokenPosition, InterpreterDatabase, Ref,
  Column,
} from '@/core/interpreter/types';
import { SyntaxTokenKind } from '@/core/lexer/tokens';
import { isDotDelimitedIdentifier, isExpressionAnIdentifierNode, isExpressionAQuotedString } from '@/core/parser/utils';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { getNumberTextFromExpression, parseNumber } from '@/core/utils';
import { isExpressionASignedNumberExpression, isValidPartialInjection } from '../analyzer/validator/utils';

export function extractNamesFromRefOperand (operand: SyntaxNode, owner?: Table): { schemaName: string | null; tableName: string; fieldNames: string[] } {
  const { variables, tupleElements } = destructureComplexVariableTuple(operand).unwrap();

  const tupleNames = tupleElements.map((e) => extractVarNameFromPrimaryVariable(e).unwrap());
  const variableNames = variables.map((e) => extractVarNameFromPrimaryVariable(e).unwrap());

  if (tupleElements.length) {
    if (variables.length === 0) {
      return {
        schemaName: owner!.schemaName,
        tableName: owner!.name,
        fieldNames: tupleNames,
      };
    }

    return {
      tableName: variableNames.pop()!,
      schemaName: variableNames.pop() || null,
      fieldNames: tupleNames,
    };
  }

  if (variables.length === 1) {
    return {
      schemaName: owner!.schemaName,
      tableName: owner!.name,
      fieldNames: [variableNames[0]],
    };
  }

  return {
    fieldNames: [variableNames.pop()!],
    tableName: variableNames.pop()!,
    schemaName: variableNames.pop() || null,
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

  if (isExpressionASignedNumberExpression(valueNode)) {
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

export function processColumnType (typeNode: SyntaxNode, env: InterpreterDatabase): Report<ColumnType> {
  let typeSuffix: string = '';
  let typeArgs: string | null = null;
  let numericParams: { precision: number; scale: number } | undefined;
  let lengthParam: { length: number } | undefined;
  let isEnum = undefined;

  if (typeNode instanceof CallExpressionNode) {
    const argElements = typeNode.argumentList!.elementList;
    typeArgs = argElements.map((e) => {
      if (isExpressionASignedNumberExpression(e)) {
        return getNumberTextFromExpression(e);
      }
      if (isExpressionAQuotedString(e)) {
        return extractQuotedStringToken(e).unwrap();
      }
      // e can only be an identifier here
      return extractVariableFromExpression(e).unwrap();
    }).join(',');
    typeSuffix = `(${typeArgs})`;

    // Parse numeric type parameters (precision, scale)
    if (argElements.length === 2
      && isExpressionASignedNumberExpression(argElements[0])
      && isExpressionASignedNumberExpression(argElements[1])) {
      try {
        const precision = parseNumber(argElements[0] as any);
        const scale = parseNumber(argElements[1] as any);
        if (!isNaN(precision) && !isNaN(scale)) {
          numericParams = { precision: Math.trunc(precision), scale: Math.trunc(scale) };
        }
      } catch {
        // If parsing fails, just skip setting numericParams
      }
    } else if (argElements.length === 1 && isExpressionASignedNumberExpression(argElements[0])) {
      try {
        const length = parseNumber(argElements[0] as any);
        if (!isNaN(length)) {
          lengthParam = { length: Math.trunc(length) };
        }
      } catch {
        // If parsing fails, just skip setting lengthParam
      }
    }

    typeNode = typeNode.callee!;
  }
  while (typeNode instanceof CallExpressionNode || typeNode instanceof ArrayNode) {
    if (typeNode instanceof CallExpressionNode) {
      const args = typeNode
        .argumentList!.elementList.map((e) => {
        if (isExpressionASignedNumberExpression(e)) {
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

  // Check if this type references an enum
  const schema = typeSchemaName.length === 0 ? null : typeSchemaName[0];
  for (const enumObj of env.enums.values()) {
    if (enumObj.name === typeName && enumObj.schemaName === schema) {
      isEnum = true;
      break;
    }
  }

  if (typeSchemaName.length > 1) {
    return new Report(
      {
        schemaName: typeSchemaName.length === 0 ? null : typeSchemaName[0],
        type_name: `${typeName}${typeSuffix}`,
        args: typeArgs,
        numericParams,
        lengthParam,
        isEnum,
      },
      [new CompileError(CompileErrorCode.UNSUPPORTED, 'Nested schema is not supported', typeNode)],
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

// The returned table respects (injected) column definition order
export function mergeTableAndPartials (table: Table, env: InterpreterDatabase): Table {
  const tableElement = [...env.tables.entries()].find(([, t]) => t === table)?.[0];
  if (!tableElement) {
    throw new Error('mergeTableAndPartials should be called after all tables are interpreted');
  }
  if (!(tableElement.body instanceof BlockExpressionNode)) {
    throw new Error('Table element should have a block body');
  }

  const indexes = [...table.indexes];
  const checks = [...table.checks];
  let headerColor = table.headerColor;
  let note = table.note;

  const tablePartials = [...env.tablePartials.values()];
  // Prioritize later table partials
  for (const tablePartial of [...table.partials].reverse()) {
    const { name } = tablePartial;
    const partial = tablePartials.find((p) => p.name === name);
    if (!partial) continue;

    // Merge indexes
    indexes.push(...partial.indexes);

    // Merge checks
    checks.push(...partial.checks);

    // Merge settings (later partials override)
    if (partial.headerColor !== undefined) {
      headerColor = partial.headerColor;
    }
    if (partial.note !== undefined) {
      note = partial.note;
    }
  }

  const directFieldMap = new Map(table.fields.map((f) => [f.name, f]));
  const directFieldNames = new Set(directFieldMap.keys());
  const partialMap = new Map(tablePartials.map((p) => [p.name, p]));

  // Collect all fields in declaration order
  const allFields: Column[] = [];

  for (const subfield of tableElement.body.body) {
    if (!(subfield instanceof FunctionApplicationNode)) continue;

    if (isValidPartialInjection(subfield.callee)) {
      // Inject partial fields
      const partialName = extractVariableFromExpression(subfield.callee.expression).unwrap_or(undefined);
      const partial = partialMap.get(partialName!);
      if (!partial) continue;

      for (const field of partial.fields) {
        // Skip if overridden by direct definition
        if (directFieldNames.has(field.name)) continue;
        allFields.push(field);
      }
    } else {
      // Add direct field definition
      const columnName = extractVariableFromExpression(subfield.callee).unwrap();
      const column = directFieldMap.get(columnName);
      if (!column) continue;
      allFields.push(column);
    }
  }

  // Use uniqBy to keep last occurrence of each field (later partials win)
  // Process from end to start, then reverse to maintain declaration order
  const fields = uniqBy([...allFields].reverse(), 'name').reverse();

  return {
    ...table,
    fields,
    indexes,
    checks,
    headerColor,
    note,
  };
}

export function extractInlineRefsFromTablePartials (table: Table, env: InterpreterDatabase): Ref[] {
  const refs: Ref[] = [];
  const tablePartials = [...env.tablePartials.values()];
  const originalFieldNames = new Set(table.fields.map((f) => f.name));

  // Process partials in the same order as mergeTableAndPartials
  for (const tablePartial of [...table.partials].reverse()) {
    const { name } = tablePartial;
    const partial = tablePartials.find((p) => p.name === name);
    if (!partial) continue;

    // Extract inline refs from partial fields
    for (const field of partial.fields) {
      // Skip if this field is overridden by the original table
      if (originalFieldNames.has(field.name)) continue;

      for (const inlineRef of field.inline_refs) {
        const multiplicities = getMultiplicities(inlineRef.relation);
        refs.push({
          name: null,
          schemaName: null,
          token: inlineRef.token,
          endpoints: [
            {
              schemaName: inlineRef.schemaName,
              tableName: inlineRef.tableName,
              fieldNames: inlineRef.fieldNames,
              token: inlineRef.token,
              relation: multiplicities[1],
            },
            {
              schemaName: table.schemaName,
              tableName: table.name,
              fieldNames: [field.name],
              token: field.token,
              relation: multiplicities[0],
            },
          ],
        });
      }
    }
  }

  return refs;
}
