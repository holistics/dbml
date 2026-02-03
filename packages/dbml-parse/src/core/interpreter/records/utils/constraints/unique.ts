import { CompileError } from '@/core/errors';
import { InterpreterDatabase, Table, Column, TableRecordRow } from '@/core/interpreter/types';
import {
  extractKeyValueWithDefault,
  hasNullWithoutDefaultInKey,
  formatFullColumnNames,
  formatValues,
  createConstraintErrors,
} from './helper';
import { mergeTableAndPartials } from '@/core/interpreter/utils';
import { keyBy, groupBy, compact, isEmpty, filter, flatMap } from 'lodash-es';

const getConstraintType = (columnCount: number) =>
  columnCount > 1 ? 'Composite UNIQUE' : 'UNIQUE';

export function validateUnique (env: InterpreterDatabase): CompileError[] {
  return flatMap(Array.from(env.records), ([table, rows]) => {
    if (!env.cachedMergedTables.has(table)) {
      env.cachedMergedTables.set(table, mergeTableAndPartials(table, env));
    }
    const mergedTable = env.cachedMergedTables.get(table)!;

    if (isEmpty(rows)) return [];

    const uniqueConstraints = collectUniqueConstraints(mergedTable);
    const columnMap = keyBy(mergedTable.fields, 'name');

    return flatMap(uniqueConstraints, (uniqueColumns) => {
      const uniqueColumnFields = compact(uniqueColumns.map(col => columnMap[col]));
      return checkUniqueDuplicates(rows, uniqueColumns, uniqueColumnFields, mergedTable);
    });
  });
}

function collectUniqueConstraints(mergedTable: Table): string[][] {
  return [
    ...mergedTable.fields.filter(field => field.unique).map(field => [field.name]),
    ...mergedTable.indexes.filter(index => index.unique).map(index => index.columns.map(c => c.value))
  ];
}

function checkUniqueDuplicates(
  rows: TableRecordRow[],
  uniqueColumns: string[],
  uniqueColumnFields: (Column | undefined)[],
  mergedTable: Table,
): CompileError[] {
  // Filter out rows with NULL values (SQL standard: NULLs don't conflict in UNIQUE constraints)
  const rowsWithoutNull = rows.filter(row =>
    !hasNullWithoutDefaultInKey(row.values, uniqueColumns, uniqueColumnFields)
  );

  // Group rows by their unique key value
  const rowsByKeyValue = groupBy(rowsWithoutNull, row =>
    extractKeyValueWithDefault(row.values, uniqueColumns, uniqueColumnFields)
  );

  // Find groups with more than 1 row (duplicates)
  const duplicateGroups = filter(rowsByKeyValue, group => group.length > 1);

  // Transform duplicate groups to errors
  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(uniqueColumns.length);
    const columnRef = formatFullColumnNames(
      mergedTable.schemaName,
      mergedTable.name,
      uniqueColumns
    );

    // Skip first occurrence, report rest as duplicates
    return flatMap(duplicateRows.slice(1), row => {
      const valueStr = formatValues(row.values, uniqueColumns);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return createConstraintErrors(row, uniqueColumns, message);
    });
  });
}
