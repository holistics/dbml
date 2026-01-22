import type Compiler from '../../../index';
import { formatRecordValue } from '../../utils';
import { ElementDeclarationNode, BlockExpressionNode, FunctionApplicationNode } from '@/core/parser/nodes';
import { normalizeTableName, type TableNameInput } from '../utils';
import { applyTextEdits, type TextEdit } from '../applyTextEdits';
import type { RecordValue } from './types';
import { findRecordsForTable, extractRowValues } from './utils';

/**
 * Updates a specific field value in one row for a table.
 */
export function updateRecordField (
  this: Compiler,
  targetName: TableNameInput,
  rowIndex: number,
  fieldName: string,
  newValue: RecordValue,
): string {
  const source = this.parse.source();

  const { schema: schemaName, table: tableName } = normalizeTableName(targetName);

  // Find existing Records elements for this table
  const existingRecords = findRecordsForTable(this, schemaName, tableName);

  if (existingRecords.length === 0) {
    return source;
  }

  // Find which Records block contains the target row
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

  const { element, columns } = targetBlock;
  const fieldIndex = columns.indexOf(fieldName);

  if (fieldIndex < 0) {
    return source; // Column not found
  }

  const body = element.body;
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
  const targetValue = values[fieldIndex];

  if (!targetValue) {
    return source;
  }

  // Replace the value
  const edits: TextEdit[] = [{
    start: targetValue.start,
    end: targetValue.end,
    newText: formatRecordValue(newValue),
  }];

  return applyTextEdits(source, edits);
}
