import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type Compiler from '../../../index';
import { formatRecordValue, addDoubleQuoteIfNeeded } from '../../utils';
import { normalizeTableName, type TableNameInput } from '../utils';
import type { RecordValue } from './types';
import { findRecordsForTable } from './utils';
import { ElementDeclarationNode } from '@/core/parser/nodes';

/**
 * Normalizes a RecordValue or string to RecordValue.
 */
function normalizeRecordValue (value: RecordValue | string): RecordValue {
  if (typeof value === 'string' || value === null) {
    return { value, type: 'string' };
  }
  return value;
}

/**
 * Checks if a Records block's columns are a superset of the target columns.
 */
function doesRecordMatchColumns (recordsColumns: string[], targetColumns: string[]): boolean {
  const recordsSet = new Set(recordsColumns);
  return targetColumns.every((col) => recordsSet.has(col));
}

/**
 * Inserts rows into an existing Records block by reordering values to match.
 */
function insertIntoExistingRecords (
  source: string,
  element: ElementDeclarationNode,
  recordsColumns: string[],
  targetColumns: string[],
  values: (RecordValue | string)[][],
): string {
  const body = element.body;
  if (!body) {
    return source;
  }

  // Build the new rows
  const newRows: string[] = [];
  for (const row of values) {
    const reorderedValues: string[] = [];
    for (const col of recordsColumns) {
      const targetIndex = targetColumns.indexOf(col);
      if (targetIndex >= 0 && targetIndex < row.length) {
        reorderedValues.push(formatRecordValue(normalizeRecordValue(row[targetIndex])));
      } else {
        reorderedValues.push('null');
      }
    }
    newRows.push('  ' + reorderedValues.join(', '));
  }

  // Find the position to insert (before the closing brace)
  const closingBracePos = body.end - 1;
  const beforeBrace = source.slice(0, closingBracePos);
  const afterBrace = source.slice(closingBracePos);

  // Add newline if the body is not empty
  const bodyText = source.slice(body.start + 1, body.end - 1).trim();
  const separator = bodyText.length > 0 ? '\n' : '';

  return beforeBrace + separator + newRows.join('\n') + '\n' + afterBrace;
}

/**
 * Appends a new Records block to the end of the source.
 */
function appendNewRecordsBlock (
  source: string,
  schemaName: string,
  tableName: string,
  columns: string[],
  values: (RecordValue | string)[][],
): string {
  const tableQualifier = schemaName === DEFAULT_SCHEMA_NAME
    ? addDoubleQuoteIfNeeded(tableName)
    : `${addDoubleQuoteIfNeeded(schemaName)}.${addDoubleQuoteIfNeeded(tableName)}`;

  const columnList = columns.map(addDoubleQuoteIfNeeded).join(', ');

  const rows: string[] = [];
  for (const row of values) {
    const formattedValues = row.map((v) => formatRecordValue(normalizeRecordValue(v)));
    rows.push('  ' + formattedValues.join(', '));
  }

  const recordsBlock = `\nrecords ${tableQualifier}(${columnList}) {\n${rows.join('\n')}\n}\n`;

  return source + recordsBlock;
}

/**
 * Appends records to a table, merging into the last matching Records block if possible.
 */
export function appendRecords (
  this: Compiler,
  tableName: TableNameInput,
  columns: string[],
  values: (RecordValue | string)[][],
): string {
  // Validation
  if (columns.length === 0) {
    throw new Error('Columns must not be empty');
  }

  if (values.length === 0) {
    return this.parse.source();
  }

  // Validate all rows have correct number of values
  for (const row of values) {
    if (row.length !== columns.length) {
      throw new Error('Data record entry does not have the same columns');
    }
  }

  const source = this.parse.source();
  const { schema: schemaName, table: tableNameStr } = normalizeTableName(tableName);

  // Find existing Records blocks
  const existingRecords = findRecordsForTable(this, schemaName, tableNameStr);

  // Check if last Records block can be merged into
  if (existingRecords.length > 0) {
    const lastRecord = existingRecords[existingRecords.length - 1];
    if (doesRecordMatchColumns(lastRecord.columns, columns)) {
      return insertIntoExistingRecords(source, lastRecord.element, lastRecord.columns, columns, values);
    }
  }

  // Append new Records block
  return appendNewRecordsBlock(source, schemaName, tableNameStr, columns, values);
}
