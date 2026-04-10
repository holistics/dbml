import type { CompileWarning } from '@/core/types/errors';
import type { Table, Column, TableRecord } from '@/core/types/schemaJson';
import {
  buildColumnIndex,
  extractKeyValueWithDefault,
  hasNullWithoutDefaultInKey,
  formatFullColumnNames,
  formatValues,
  createConstraintErrors,
} from './helper';
import { keyBy, groupBy, compact, isEmpty, filter, flatMap } from 'lodash-es';
import { InterpreterDatabase, TableRecordRow } from '@/core/interpreter/types';

type CompileError = CompileWarning;

const getConstraintType = (columnCount: number) =>
  columnCount > 1 ? 'Composite UNIQUE' : 'UNIQUE';

export function validateUnique (record: TableRecord, mergedTable: Table): CompileError[] {
  if (isEmpty(record.values)) return [];

  const uniqueConstraints = collectUniqueConstraints(mergedTable);
  const columnIndex = buildColumnIndex(record);
  const columnMap = keyBy(mergedTable.fields, 'name');

  return flatMap(uniqueConstraints, (uniqueColumns) => {
    const uniqueColumnFields = compact(uniqueColumns.map((col) => columnMap[col]));
    return checkUniqueDuplicates(record, uniqueColumns, uniqueColumnFields, columnIndex, mergedTable);
  });
}

function collectUniqueConstraints (mergedTable: Table): string[][] {
  return [
    ...mergedTable.fields.filter((field) => field.unique).map((field) => [field.name]),
    ...mergedTable.indexes.filter((index) => index.unique).map((index) => index.columns.map((c) => c.value)),
  ];
}

function checkUniqueDuplicates (
  record: TableRecord,
  uniqueColumns: string[],
  uniqueColumnFields: (Column | undefined)[],
  columnIndex: Map<string, number>,
  mergedTable: Table,
): CompileError[] {
  // Filter out rows with NULL values (SQL standard: NULLs don't conflict in UNIQUE constraints)
  const rowsWithoutNull = record.values.filter((row) =>
    !hasNullWithoutDefaultInKey(row, uniqueColumns, columnIndex, uniqueColumnFields),
  );

  // Group rows by their unique key value
  const rowsByKeyValue = groupBy(rowsWithoutNull, (row) =>
    extractKeyValueWithDefault(row, uniqueColumns, columnIndex, uniqueColumnFields),
  );

  // Find groups with more than 1 row (duplicates)
  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  // Transform duplicate groups to errors
  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(uniqueColumns.length);
    const columnRef = formatFullColumnNames(
      mergedTable.schemaName,
      mergedTable.name,
      uniqueColumns,
    );

    // Report all rows in the duplicate group
    return flatMap(duplicateRows, (row) => {
      const valueStr = formatValues(row, uniqueColumns, columnIndex);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return createConstraintErrors(record, message);
    });
  });
}
