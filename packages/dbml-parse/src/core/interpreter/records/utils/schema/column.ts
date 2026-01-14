import { FunctionApplicationNode, TupleExpressionNode } from '@/core/parser/nodes';
import { ColumnSymbol, EnumSymbol } from '@/core/analyzer/symbol/symbols';
import { extractReferee, extractVarNameFromPrimaryVariable } from '@/core/analyzer/utils';
import { isExpressionAVariableNode } from '@/core/parser/utils';
import {
  Table,
} from '@/core/interpreter/types';

import { ColumnSchema } from '../../types';
import { isStringType, isBinaryType, getNumericTypeParams, getLengthTypeParam, isNumericType } from '../data/sqlTypes';

// Get column name from a ColumnSymbol
export function getColumnName (columnSymbol: ColumnSymbol): string {
  const declaration = columnSymbol.declaration;
  if (declaration instanceof FunctionApplicationNode && declaration.callee && isExpressionAVariableNode(declaration.callee)) {
    return extractVarNameFromPrimaryVariable(declaration.callee).unwrap_or('');
  }
  return '';
}

// Extract ColumnSymbols from a tuple expression (e.g., (col1, col2))
export function getColumnSymbolsFromTuple (tuple: TupleExpressionNode): ColumnSymbol[] {
  const symbols: ColumnSymbol[] = [];
  for (const element of tuple.elementList) {
    const referee = extractReferee(element);
    if (referee instanceof ColumnSymbol) {
      symbols.push(referee);
    }
  }
  return symbols;
}

// Check if a column type is an enum by looking up in env.enums
function isEnumType (column: ColumnSymbol): boolean {
  const columnNode = column.declaration;
  if (!(columnNode instanceof FunctionApplicationNode)) {
    return false;
  }
  const type = columnNode.args[0];
  const referree = extractReferee(type);
  return referree instanceof EnumSymbol;
}

export function processColumnSchemas (
  table: Table,
  columnSymbols: ColumnSymbol[],
): ColumnSchema[] {
  const columns: ColumnSchema[] = [];

  for (const columnSymbol of columnSymbols) {
    const colName = getColumnName(columnSymbol);
    const column = table.fields.find((f) => f.name === colName);
    if (!column) continue;
    const typeName = column.type.type_name;

    columns.push({
      name: column.name,
      // FIXME: make this more precise
      type: typeName.split('(')[0], // remove the type arg
      isEnum: isEnumType(columnSymbol),
      notNull: column.not_null || false,
      dbdefault: column.dbdefault,
      increment: column.increment || false,
      numericTypeParams: isNumericType(typeName) ? getNumericTypeParams(columnSymbol) : {},
      stringTypeParams: isStringType(typeName) ? getLengthTypeParam(columnSymbol) : {},
      binaryTypeParams: isBinaryType(typeName) ? getLengthTypeParam(columnSymbol) : {},
    });
  }

  return columns;
}
