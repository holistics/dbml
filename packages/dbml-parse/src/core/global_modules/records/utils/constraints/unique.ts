import {
  compact, filter, flatMap, groupBy, isEmpty, keyBy,
} from 'lodash-es';
import type {
  CompileWarning,
} from '@/core/types/errors';
import type {
  Column, Table, TableRecord,
} from '@/core/types/schemaJson';
import {
  RecordNodes,
  buildColumnIndex,
  createConstraintErrors,
  extractKeyValueWithDefault,
  formatFullColumnNames,
  formatValues,
  hasNullWithoutDefaultInKey,
  pickCell,
} from './helper';

type CompileError = CompileWarning;

const getConstraintType = (columnCount: number) =>
  columnCount > 1 ? 'Composite UNIQUE' : 'UNIQUE';

export function validateUnique (nodes: RecordNodes, record: TableRecord, mergedTable: Table): CompileError[] {
  if (isEmpty(record.values)) return [];

  const uniqueConstraints = collectUniqueConstraints(mergedTable);
  const columnIndex = buildColumnIndex(record);
  const columnMap = keyBy(mergedTable.fields, 'name');

  return flatMap(uniqueConstraints, (uniqueColumns) => {
    const uniqueColumnFields = compact(uniqueColumns.map((col) => columnMap[col]));
    return checkUniqueDuplicates(nodes, record, uniqueColumns, uniqueColumnFields, columnIndex, mergedTable);
  });
}

function collectUniqueConstraints (mergedTable: Table): string[][] {
  return [
    ...mergedTable.fields.filter((field) => field.unique).map((field) => [
      field.name,
    ]),
    ...mergedTable.indexes.filter((index) => index.unique).map((index) => index.columns.map((c) => c.value)),
  ];
}

function checkUniqueDuplicates (
  nodes: RecordNodes,
  record: TableRecord,
  uniqueColumns: string[],
  uniqueColumnFields: (Column | undefined)[],
  columnIndex: Map<string, number>,
  mergedTable: Table,
): CompileError[] {
  // Keep row indices alongside values so we can anchor warnings on the
  // offending row's column cell.
  const rowIndices = record.values.map((_, i) => i).filter((i) =>
    !hasNullWithoutDefaultInKey(record.values[i], uniqueColumns, columnIndex, uniqueColumnFields),
  );

  const rowsByKeyValue = groupBy(rowIndices, (idx) =>
    extractKeyValueWithDefault(record.values[idx], uniqueColumns, columnIndex, uniqueColumnFields),
  );

  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(uniqueColumns.length);
    const columnRef = formatFullColumnNames(
      mergedTable.schemaName,
      mergedTable.name,
      uniqueColumns,
    );

    return flatMap(duplicateRows, (idx) => {
      const valueStr = formatValues(record.values[idx], uniqueColumns, columnIndex);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return uniqueColumns.flatMap((col) => createConstraintErrors(pickCell(nodes, idx, col), message));
    });
  });
}
