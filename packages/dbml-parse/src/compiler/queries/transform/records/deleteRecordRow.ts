import type Compiler from '../../../index';
import { ElementDeclarationNode, BlockExpressionNode, FunctionApplicationNode } from '@/core/parser/nodes';
import { normalizeTableName, type TableNameInput } from '../utils';
import { applyTextEdits, type TextEdit } from '../applyTextEdits';
import { findRecordsForTable } from './utils';

/**
 * Deletes a specific row from records by index.
 */
export function deleteRecordRow (
  this: Compiler,
  targetName: TableNameInput,
  rowIndex: number,
): string {
  const source = this.parse.source();
  const { schema: schemaName, table: tableName } = normalizeTableName(targetName);

  const existingRecords = findRecordsForTable(this, schemaName, tableName).map((r) => r.element);

  if (existingRecords.length === 0) {
    return source;
  }

  let targetBlock: ElementDeclarationNode | null = null;
  let localIndex = rowIndex;

  // Find which Records block contains the target row
  for (const element of existingRecords) {
    const body = element.body;
    if (!(body instanceof BlockExpressionNode)) {
      continue;
    }

    const rowCount = body.body.filter((node) => node instanceof FunctionApplicationNode).length;

    if (localIndex < rowCount) {
      targetBlock = element;
      break;
    }

    localIndex -= rowCount;
  }

  if (!targetBlock) {
    return source; // Index out of range
  }

  const body = targetBlock.body;
  if (!(body instanceof BlockExpressionNode)) {
    return source;
  }

  // Get data rows from AST
  const dataRows = body.body.filter((node): node is FunctionApplicationNode => node instanceof FunctionApplicationNode);

  // Check if we're deleting the last row
  if (dataRows.length === 1) {
    // Remove the entire Records element
    const edits: TextEdit[] = [{
      start: targetBlock.fullStart,
      end: targetBlock.fullEnd,
      newText: '',
    }];

    return applyTextEdits(source, edits);
  }

  // Delete the specific row
  const targetRow = dataRows[localIndex];
  const edits: TextEdit[] = [{
    start: targetRow.fullStart,
    end: targetRow.fullEnd,
    newText: '',
  }];

  return applyTextEdits(source, edits);
}
