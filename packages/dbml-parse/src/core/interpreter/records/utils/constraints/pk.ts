import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase, Table, Column, TableRecordRow } from '@/core/interpreter/types';
import {
  extractKeyValueWithDefault,
  hasNullWithoutDefaultInKey,
  isAutoIncrementColumn,
  formatFullColumnNames,
  formatValues,
  createConstraintErrors,
} from './helper';
import { mergeTableAndPartials } from '@/core/interpreter/utils';
import { isSerialType } from '../data';
import { keyBy, groupBy, partition, compact, isEmpty, difference, filter, flatMap } from 'lodash-es';

const getConstraintType = (columnCount: number) =>
  columnCount > 1 ? 'Composite PK' : 'PK';

export function validatePrimaryKey (env: InterpreterDatabase): CompileError[] {
  return flatMap(Array.from(env.records), ([table, rows]) => {
    if (isEmpty(rows)) return [];

    if (!env.cachedMergedTables.has(table)) {
      env.cachedMergedTables.set(table, mergeTableAndPartials(table, env));
    }
    const mergedTable = env.cachedMergedTables.get(table)!;

    const pkConstraints = collectPkConstraints(mergedTable);
    const availableColumns = collectAvailableColumns(rows);
    const columnMap = keyBy(mergedTable.fields, 'name');

    return flatMap(pkConstraints, (pkColumns) =>
      validatePkConstraint(pkColumns, rows, availableColumns, columnMap, mergedTable),
    );
  });
}

function validatePkConstraint (
  pkColumns: string[],
  rows: TableRecordRow[],
  availableColumns: Set<string>,
  columnMap: Record<string, Column>,
  mergedTable: Table,
): CompileError[] {
  // Check for missing columns
  const missingErrors = checkMissingPkColumns(
    pkColumns,
    availableColumns,
    columnMap,
    mergedTable,
    rows,
  );
  if (!isEmpty(missingErrors)) return missingErrors;

  // Get column definitions
  const pkColumnFields = compact(pkColumns.map((col) => columnMap[col]));
  const areAllColumnsAutoIncrement = pkColumnFields.every((col) =>
    col && isAutoIncrementColumn(col),
  );

  // Partition rows into those with NULL and those without
  const [rowsWithNull, rowsWithoutNull] = partition(rows, (row) =>
    hasNullWithoutDefaultInKey(row.values, pkColumns, pkColumnFields),
  );

  // Validate NULL rows (only error if not all columns are auto-increment)
  const nullErrors = areAllColumnsAutoIncrement
    ? []
    : createNullErrors(rowsWithNull, pkColumns, mergedTable);

  // Find duplicate rows using groupBy
  const duplicateErrors = findDuplicateErrors(
    rowsWithoutNull,
    pkColumns,
    pkColumnFields,
    mergedTable,
  );

  return [...nullErrors, ...duplicateErrors];
}

function createNullErrors (
  rowsWithNull: TableRecordRow[],
  pkColumns: string[],
  mergedTable: Table,
): CompileError[] {
  if (isEmpty(rowsWithNull)) return [];

  const constraintType = getConstraintType(pkColumns.length);
  const columnRef = formatFullColumnNames(
    mergedTable.schemaName,
    mergedTable.name,
    pkColumns,
  );
  const message = `NULL in ${constraintType}: ${columnRef} cannot be NULL`;

  return flatMap(rowsWithNull, (row) =>
    createConstraintErrors(row, pkColumns, message),
  );
}

function findDuplicateErrors (
  rows: TableRecordRow[],
  pkColumns: string[],
  pkColumnFields: Column[],
  mergedTable: Table,
): CompileError[] {
  // Group rows by their PK value
  const rowsByKeyValue = groupBy(rows, (row) =>
    extractKeyValueWithDefault(row.values, pkColumns, pkColumnFields),
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

    // Skip first occurrence, report rest as duplicates
    return flatMap(duplicateRows.slice(1), (row) => {
      const valueStr = formatValues(row.values, pkColumns);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return createConstraintErrors(row, pkColumns, message);
    });
  });
}

function collectPkConstraints (mergedTable: Table): string[][] {
  return [
    ...mergedTable.fields.filter((field) => field.pk).map((field) => [field.name]),
    ...mergedTable.indexes.filter((index) => index.pk).map((index) => index.columns.map((c) => c.value)),
  ];
}

function collectAvailableColumns (rows: TableRecordRow[]): Set<string> {
  return new Set(rows.flatMap((row) => Object.keys(row.values)));
}

function checkMissingPkColumns (
  pkColumns: string[],
  availableColumns: Set<string>,
  columnMap: Record<string, Column>,
  mergedTable: Table,
  rows: TableRecordRow[],
): CompileError[] {
  // Use difference to find missing columns
  const missingColumns = difference(pkColumns, Array.from(availableColumns));
  if (isEmpty(missingColumns)) return [];

  // Filter to only those without defaults
  const hasNoDefaultValue = (colName: string): boolean => {
    const col = columnMap[colName];
    return col && !col.increment && !isSerialType(col.type.type_name) && !col.dbdefault;
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

  return rows.map((row) => new CompileError(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    message,
    row.node,
  ));
}
