import {
  compact, difference, filter, flatMap, groupBy, isEmpty, partition,
} from 'lodash-es';
import {
  CompileErrorCode, CompileWarning,
} from '@/core/types/errors';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  Column, Table, TableRecord,
} from '@/core/types/schemaJson';
import {
  isSerialType,
} from '../data';
import {
  RecordNodes,
  buildColumnIndex,
  createConstraintErrors,
  extractKeyValueWithDefault,
  formatFullColumnNames,
  formatValues,
  hasNullWithoutDefaultInKey,
  isAutoIncrementColumn,
  pickCell,
} from './helper';

const getConstraintType = (columnCount: number) =>
  columnCount > 1 ? 'Composite PK' : 'PK';

export function validatePrimaryKey (nodes: RecordNodes, record: TableRecord, mergedTable: Table): CompileWarning[] {
  const rows = record.values;
  if (isEmpty(rows)) return [];

  const pkConstraints = collectPkConstraints(mergedTable);
  const columnIndex = buildColumnIndex(record);
  const availableColumns = collectAvailableColumns(record);
  const columnMap = new Map(mergedTable.fields.map((f) => [
    f.name,
    f,
  ]));

  return flatMap(pkConstraints, (pkColumns) =>
    validatePkConstraint(nodes, pkColumns, record, availableColumns, columnMap, columnIndex, mergedTable),
  );
}

function validatePkConstraint (
  nodes: RecordNodes,
  pkColumns: string[],
  record: TableRecord,
  availableColumns: Set<string>,
  columnMap: Map<string, Column>,
  columnIndex: Map<string, number>,
  mergedTable: Table,
): CompileWarning[] {
  // Check for missing columns
  const missingErrors = checkMissingPkColumns(
    nodes,
    pkColumns,
    availableColumns,
    columnMap,
    mergedTable,
    record,
  );
  if (!isEmpty(missingErrors)) return missingErrors;

  // Get column definitions
  const pkColumnFields = compact(pkColumns.map((col) => columnMap.get(col)));
  const areAllColumnsAutoIncrement = pkColumnFields.every((col) =>
    col && isAutoIncrementColumn(col),
  );

  // Partition rows into those with NULL and those without
  const rowIndices = record.values.map((_, i) => i);
  const [
    rowsWithNull,
    rowsWithoutNull,
  ] = partition(rowIndices, (i) =>
    hasNullWithoutDefaultInKey(record.values[i], pkColumns, columnIndex, pkColumnFields),
  );

  // Validate NULL rows (only error if not all columns are auto-increment)
  const nullErrors = areAllColumnsAutoIncrement
    ? []
    : createNullErrors(nodes, rowsWithNull, pkColumns, mergedTable);

  // Find duplicate rows using groupBy
  const duplicateErrors = findDuplicateErrors(
    nodes,
    rowsWithoutNull,
    record,
    pkColumns,
    pkColumnFields,
    columnIndex,
    mergedTable,
  );

  return [
    ...nullErrors,
    ...duplicateErrors,
  ];
}

function createNullErrors (
  nodes: RecordNodes,
  rowsWithNull: number[],
  pkColumns: string[],
  mergedTable: Table,
): CompileWarning[] {
  if (isEmpty(rowsWithNull)) return [];

  const constraintType = getConstraintType(pkColumns.length);
  const columnRef = formatFullColumnNames(
    mergedTable.schemaName,
    mergedTable.name,
    pkColumns,
  );
  const message = `NULL in ${constraintType}: ${columnRef} cannot be NULL`;

  // Anchor each warning on the offending row's column cell.
  return flatMap(rowsWithNull, (rowIdx) =>
    pkColumns.flatMap((col) => createConstraintErrors(pickCell(nodes, rowIdx, col), message)),
  );
}

function findDuplicateErrors (
  nodes: RecordNodes,
  rows: number[],
  record: TableRecord,
  pkColumns: string[],
  pkColumnFields: Column[],
  columnIndex: Map<string, number>,
  mergedTable: Table,
): CompileWarning[] {
  // Group rows by their PK value
  const rowsByKeyValue = groupBy(rows, (idx) =>
    extractKeyValueWithDefault(record.values[idx], pkColumns, columnIndex, pkColumnFields),
  );

  // Find groups with more than 1 row (duplicates)
  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  // Transform duplicate groups to errors
  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(pkColumns.length);
    const columnRef = formatFullColumnNames(
      mergedTable.schemaName,
      mergedTable.name,
      pkColumns,
    );

    // Report all rows in the duplicate group, anchored on the offending row.
    return flatMap(duplicateRows, (idx) => {
      const valueStr = formatValues(record.values[idx], pkColumns, columnIndex);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return pkColumns.flatMap((col) => createConstraintErrors(pickCell(nodes, idx, col), message));
    });
  });
}

function collectPkConstraints (mergedTable: Table): string[][] {
  return [
    ...mergedTable.fields.filter((field) => field.pk).map((field) => [
      field.name,
    ]),
    ...mergedTable.indexes.filter((index) => index.pk).map((index) => index.columns.map((c) => c.value)),
  ];
}

function collectAvailableColumns (record: TableRecord): Set<string> {
  return new Set(record.columns);
}

function checkMissingPkColumns (
  nodes: RecordNodes,
  pkColumns: string[],
  availableColumns: Set<string>,
  columnMap: Map<string, Column>,
  mergedTable: Table,
  record: TableRecord,
): CompileWarning[] {
  // Use difference to find missing columns
  const missingColumns = difference(pkColumns, Array.from(availableColumns));
  if (isEmpty(missingColumns)) return [];

  // Filter to only those without defaults
  const hasNoDefaultValue = (colName: string): boolean => {
    const col = columnMap.get(colName);
    return !!(col && !col.increment && !isSerialType(col.type.type_name) && !col.dbdefault);
  };

  const missingWithoutDefaults = missingColumns.filter(hasNoDefaultValue);
  if (isEmpty(missingWithoutDefaults)) return [];

  const constraintType = getConstraintType(missingWithoutDefaults.length);
  const columnRef = formatFullColumnNames(
    mergedTable.schemaName,
    mergedTable.name,
    missingWithoutDefaults,
  );
  const message = `${constraintType}: Column ${columnRef} is missing from record and has no default value`;

  // Missing-column is row-independent — anchor on the records block itself.
  return record.values.map(() => new CompileWarning(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    message,
    nodes.block,
  ));
}
