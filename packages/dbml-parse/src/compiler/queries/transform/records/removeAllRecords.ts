import type Compiler from '../../../index';
import { normalizeTableName, type TableNameInput } from '../utils';
import { applyTextEdits, type TextEdit } from '../applyTextEdits';
import { findRecordsForTable } from './utils';

/**
 * Removes all Records blocks for a table.
 */
export function removeAllRecords (
  this: Compiler,
  targetName: TableNameInput,
): string {
  const source = this.parse.source();
  const { schema: schemaName, table: tableName } = normalizeTableName(targetName);

  const existingRecords = findRecordsForTable(this, schemaName, tableName).map((r) => r.element);

  if (existingRecords.length === 0) {
    return source;
  }

  // Create text edits for each Records element
  const edits: TextEdit[] = existingRecords.map((element) => {
    return {
      start: element.fullStart,
      end: element.fullEnd,
      newText: '',
    };
  });

  return applyTextEdits(source, edits);
}
