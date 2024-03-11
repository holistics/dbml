import _ from 'lodash';
import { ColumnSymbol } from '../analyzer/symbol/symbols';
import {
 destructureComplexVariableTuple, destructureComplexVariable, destructureMemberAccessExpression, extractVarNameFromPrimaryVariable,
} from '../analyzer/utils';
import {
 LiteralNode, PrimaryExpressionNode, SyntaxNode, TupleExpressionNode,
} from '../parser/nodes';
import { RelationCardinality, Table, TokenPosition } from './types';
import { SyntaxTokenKind } from '../lexer/tokens';

export function extractNamesFromRefOperand(operand: SyntaxNode, owner?: Table): { schemaName: string | null; tableName: string; fieldNames: string[] } {
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

export function getMultiplicities(
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
  }
  throw new Error('Invalid relation op');
}

export function getTokenPosition(node: SyntaxNode): TokenPosition {
  return {
    start: {
      offset: node.startPos.offset,
      line: node.startPos.line + 1,
      column: node.startPos.column + 1,
    },
    end: { offset: node.endPos.offset, line: node.endPos.line + 1, column: node.endPos.column + 1 },
  };
}

export function getColumnSymbolsOfRefOperand(ref: SyntaxNode): ColumnSymbol[] {
  const colNode = destructureMemberAccessExpression(ref).unwrap_or(undefined)?.pop();
  if (colNode instanceof TupleExpressionNode) {
    return colNode.elementList.map((e) => e.referee as ColumnSymbol);
  }

  return [colNode!.referee as ColumnSymbol];
}

export function extractElementName(nameNode: SyntaxNode): { schemaName: string[]; name: string } {
  const fragments = destructureComplexVariable(nameNode).unwrap();
  const name = fragments.pop()!;

    return {
    name,
    schemaName: fragments,
  };
}

export function extractColor(node: PrimaryExpressionNode & { expression: LiteralNode } & { literal: { kind: SyntaxTokenKind.COLOR_LITERAL }}): string {
  return node.expression.literal!.value;
}

export function getRefId(sym1: ColumnSymbol, sym2: ColumnSymbol): string;
export function getRefId(sym1: ColumnSymbol[], sym2: ColumnSymbol[]): string;
export function getRefId(sym1: ColumnSymbol | ColumnSymbol[], sym2: ColumnSymbol | ColumnSymbol[]): string {
  if (Array.isArray(sym1)) {
    const firstIds = sym1.map(({ id }) => id).sort().join(',');  
    const secondIds = (sym2 as ColumnSymbol[]).map(({ id }) => id).sort().join(',');  
    return firstIds < secondIds ? `${firstIds}-${secondIds}` : `${secondIds}-${firstIds}`;
  }

  const firstId = sym1.id.toString();
  const secondId = (sym2 as ColumnSymbol).id.toString();
  return firstId < secondId ? `${firstId}-${secondId}` : `${secondId}-${firstId}`;
}

export function isSameEndpoint(sym1: ColumnSymbol, sym2: ColumnSymbol): boolean;
export function isSameEndpoint(sym1: ColumnSymbol[], sym2: ColumnSymbol[]): boolean;
export function isSameEndpoint(sym1: ColumnSymbol | ColumnSymbol[], sym2: ColumnSymbol | ColumnSymbol[]): boolean {
  if (Array.isArray(sym1)) {
    const firstIds = sym1.map(({ id }) => id).sort();
    const secondIds = (sym2 as ColumnSymbol[]).map(({ id }) => id).sort();

    return _.zip(firstIds, secondIds).every(([first, second]) => first === second);
  }

  const firstId = sym1.id;
  const secondId = (sym2 as ColumnSymbol).id;

    return firstId === secondId;
}
