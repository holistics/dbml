import { ColumnSymbol } from '../analyzer/symbol/symbols';
import { destructureComplexVariable } from '../analyzer/utils';
import { CompileError, CompileErrorCode } from '../errors';
import { SyntaxNode } from '../parser/nodes';
import { RelationCardinality, TokenPosition } from './types';

export function isCircular(
  firstColumnSymbol: ColumnSymbol,
  secondColumnSymbol: ColumnSymbol,
  endpointPairSet: Set<string>,
): boolean {
  const firstId = firstColumnSymbol.id;
  const secondId = secondColumnSymbol.id;

  const endpointPairId = firstId < secondId ? `${firstId}_${secondId}` : `${secondId}_${firstId}`;
  if (endpointPairSet.has(endpointPairId)) {
    return true;
  }
  endpointPairSet.add(endpointPairId);

  return false;
}

export function isSameEndpoint(
  firstColumnSymbol: ColumnSymbol,
  secondColumnSymbol: ColumnSymbol,
): boolean {
  return firstColumnSymbol.id === secondColumnSymbol.id;
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
      columnName: string;
      tableName: string;
      schemaName: string | null;
    }
  | CompileError {
  const fragments = destructureComplexVariable(operand).unwrap();
  const columnName = fragments.pop()!;
  const tableName = fragments.pop();
  const schemaName = fragments.pop();
  if (fragments.length > 0) {
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
    columnName,
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
