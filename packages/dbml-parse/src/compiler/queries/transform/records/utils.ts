import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type Compiler from '../../../index';
import { ElementDeclarationNode, FunctionApplicationNode, CommaExpressionNode, SyntaxNode } from '@/core/parser/nodes';
import { getElementKind, extractVarNameFromPrimaryVariable, destructureCallExpression } from '@/core/analyzer/utils';
import { ElementKind } from '@/core/analyzer/types';
import { createTableSymbolIndex, createSchemaSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';

/**
 * Extracts value nodes from a row (FunctionApplicationNode).
 */
export function extractRowValues (row: FunctionApplicationNode): SyntaxNode[] {
  if (row.args.length > 0) {
    return [];
  }

  if (row.callee instanceof CommaExpressionNode) {
    return row.callee.elementList;
  }

  if (row.callee) {
    return [row.callee];
  }

  return [];
}

/**
 * Extracts column names from a Records element declaration.
 */
export function extractColumnsFromRecords (recordsDecl: ElementDeclarationNode): string[] {
  if (!recordsDecl.name) {
    return [];
  }

  const fragments = destructureCallExpression(recordsDecl.name).unwrap_or(undefined);
  if (!fragments || !fragments.args) {
    return [];
  }

  const names = fragments.args
    .map((arg) => extractVarNameFromPrimaryVariable(arg).unwrap_or(null));
  if (names.some((name) => name === null)) {
    return [];
  }
  return names as string[];
}

/**
 * Finds existing Records elements that reference the given table.
 */
export function findRecordsForTable (
  compiler: Compiler,
  schemaName: string,
  tableName: string,
): Array<{ element: ElementDeclarationNode; columns: string[] }> {
  const symbolTable = compiler.parse.publicSymbolTable();
  const ast = compiler.parse.ast();

  // Get table symbol
  const schemaIndex = createSchemaSymbolIndex(schemaName);
  const tableIndex = createTableSymbolIndex(tableName);

  let tableSymbol;
  if (schemaName === DEFAULT_SCHEMA_NAME) {
    tableSymbol = symbolTable.get(tableIndex);
  } else {
    const schemaSymbol = symbolTable.get(schemaIndex);
    tableSymbol = schemaSymbol?.symbolTable?.get(tableIndex);
  }

  if (!tableSymbol) {
    return [];
  }

  // Scan AST for top-level Records elements
  const recordsElements: Array<{ element: ElementDeclarationNode; columns: string[] }> = [];

  for (const element of ast.body) {
    const kind = getElementKind(element).unwrap_or(undefined);
    if (kind !== ElementKind.Records || !element.body) {
      continue;
    }

    // Check if this Records element references our table
    if (!element.name) {
      continue;
    }

    // Get the table reference from the Records name
    const fragments = destructureCallExpression(element.name).unwrap_or(undefined);
    if (!fragments || fragments.variables.length === 0) {
      continue;
    }

    // The last variable in the fragments is the table reference
    const tableRef = fragments.variables[fragments.variables.length - 1];
    if (tableRef.referee !== tableSymbol) continue;
    const columns = extractColumnsFromRecords(element);
    if (columns.length === 0) continue;
    recordsElements.push({ element, columns });
  }

  return recordsElements;
}
