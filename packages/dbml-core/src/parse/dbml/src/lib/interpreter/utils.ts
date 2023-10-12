import _ from 'lodash';
import { None, Option, Some } from '../option';
import { ColumnSymbol } from '../analyzer/symbol/symbols';
import {
  destructureComplexTuple,
  destructureMemberAccessExpression,
} from '../analyzer/utils';
import { CompileError, CompileErrorCode } from '../errors';
import { SyntaxNode, TupleExpressionNode } from '../parser/nodes';
import { RelationCardinality, TokenPosition } from './types';

export function isCircular(
  firstColumnSymbols: ColumnSymbol[],
  secondColumnSymbols: ColumnSymbol[],
  endpointPairSet: Set<string>,
): boolean {
  const firstIds = firstColumnSymbols.map((s) => s.id);
  const secondIds = secondColumnSymbols.map((s) => s.id);

  const endpointPairId =
    firstIds[0] < secondIds[0] ?
      `${firstIds.join(',')}_${secondIds.join(',')}` :
      `${secondIds.join(',')}_${firstIds.join(',')}`;
  if (endpointPairSet.has(endpointPairId)) {
    return true;
  }
  endpointPairSet.add(endpointPairId);

  return false;
}

export function isSameEndpoint(
  firstColumnSymbols: ColumnSymbol[],
  secondColumnSymbols: ColumnSymbol[],
): boolean {
  return _.zip(firstColumnSymbols, secondColumnSymbols).every(([f, s]) => f?.id === s?.id);
}

export function convertRelationOpToCardinalities(
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

export function processRelOperand(
  operand: SyntaxNode,
  ownerTableName: string | null,
  ownerSchemaName: string | null,
):
  | {
      columnNames: string[];
      tableName: string;
      schemaName: string | null;
    }
  | CompileError {
  const { tupleElements, variables } = destructureComplexTuple(operand).unwrap();
  const columnNames = tupleElements || [variables.pop()!];
  const tableName = variables.pop();
  const schemaName = variables.pop();
  if (variables.length > 0) {
    return new CompileError(
      CompileErrorCode.UNSUPPORTED,
      'Nested schemas are currently not allowed',
      operand,
    );
  }

  if (tableName === undefined && ownerTableName === null) {
    throw new Error("A rel operand's table name must be defined");
  }

  return {
    columnNames,
    // if tableName is undefined, the columnName must be relative to the owner
    tableName: tableName || (ownerTableName as string),
    schemaName: tableName ? schemaName || null : ownerSchemaName,
  };
}

export function extractTokenForInterpreter(node: SyntaxNode): TokenPosition {
  return {
    start: {
      offset: node.startPos.offset,
      line: node.startPos.line + 1,
      column: node.startPos.column + 1,
    },
    end: { offset: node.endPos.offset, line: node.endPos.line + 1, column: node.endPos.column + 1 },
  };
}

export function getColumnSymbolsOfRefOperand(ref: SyntaxNode): Option<ColumnSymbol[]> {
  const colNode = destructureMemberAccessExpression(ref).unwrap_or(undefined)?.pop();
  if (colNode instanceof TupleExpressionNode) {
    if (!colNode.elementList.every((e) => !!e.referee)) {
      return new None();
    }

    return new Some(colNode.elementList.map((e) => e.referee as ColumnSymbol));
  }
  if (!(colNode?.referee instanceof ColumnSymbol)) {
    return new None();
  }

  return new Some([colNode.referee]);
}

export function normalizeNoteContent(content: string): string {
  return content.split('\n').map((s) => s.trim()).join('\n');
}
