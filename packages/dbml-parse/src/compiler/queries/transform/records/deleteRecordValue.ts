import type Compiler from '../../../index';
import { ElementDeclarationNode, BlockExpressionNode, FunctionApplicationNode } from '@/core/parser/nodes';
import { normalizeTableName, type TableNameInput } from '../utils';
import { applyTextEdits, type TextEdit } from '../applyTextEdits';
import { findRecordsForTable, extractRowValues } from './utils';

/**
 * Deletes a specific value (sets to null) at row and column index.
 */
export function deleteRecordValue (
  this: Compiler,
  targetName: TableNameInput,
  rowIndex: number,
  columnName: string,
): string {
  const source = this.parse.source();
  const { schema: schemaName, table: tableName } = normalizeTableName(targetName);

  const existingRecords = findRecordsForTable(this, schemaName, tableName);

  if (existingRecords.length === 0) {
    return source;
  }

  // Find the target block and local row index
  let localIndex = rowIndex;
  let targetBlock: { element: ElementDeclarationNode; columns: string[] } | null = null;

  for (const record of existingRecords) {
    const body = record.element.body;
    if (!(body instanceof BlockExpressionNode)) {
      continue;
    }

    const rowCount = body.body.filter((node) => node instanceof FunctionApplicationNode).length;

    if (localIndex < rowCount) {
      targetBlock = record;
      break;
    }

    localIndex -= rowCount;
  }

  if (!targetBlock) {
    return source; // Index out of range
  }

  const columnIndex = targetBlock.columns.indexOf(columnName);
  if (columnIndex < 0) {
    return source; // Column not found
  }

  const body = targetBlock.element.body;
  if (!(body instanceof BlockExpressionNode)) {
    return source;
  }

  // Get data rows from AST
  const dataRows = body.body.filter((node): node is FunctionApplicationNode => node instanceof FunctionApplicationNode);
  const targetRow = dataRows[localIndex];

  if (!targetRow) {
    return source;
  }

  // Get value nodes from the row
  const values = extractRowValues(targetRow);
  const targetValue = values[columnIndex];

  if (!targetValue) {
    return source;
  }

  const edits: TextEdit[] = [{
    start: targetValue.start,
    end: targetValue.end,
    newText: 'null',
  }];

  return applyTextEdits(source, edits);
}
