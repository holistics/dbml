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

function collectUniqueConstraints (mergedTable: Table): string[][] {
  const uniqueConstraints: string[][] = [];

  for (const field of mergedTable.fields) {
    if (field.unique) uniqueConstraints.push([field.name]);
  }

  for (const index of mergedTable.indexes) {
    if (index.unique) uniqueConstraints.push(index.columns.map((c) => c.value));
  }

  return uniqueConstraints;
}

function checkUniqueDuplicates (
  rows: TableRecordRow[],
  uniqueColumns: string[],
  uniqueColumnFields: (Column | undefined)[],
  mergedTable: Table,
): CompileError[] {
  const errors: CompileError[] = [];
  const seen = new Map<string, number>();

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
    const row = rows[rowIndex];

    // NULL values don't conflict in UNIQUE constraints (SQL standard behavior)
    if (hasNullWithoutDefaultInKey(row.values, uniqueColumns, uniqueColumnFields)) {
      continue;
    }

    const keyValue = extractKeyValueWithDefault(row.values, uniqueColumns, uniqueColumnFields);
    if (seen.has(keyValue)) {
      const constraintType = uniqueColumns.length > 1 ? 'Composite UNIQUE' : 'UNIQUE';
      const columnRef = formatFullColumnNames(mergedTable.schemaName, mergedTable.name, uniqueColumns);
      const valueStr = formatValues(row.values, uniqueColumns);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;

      errors.push(...createConstraintErrors(row, uniqueColumns, message));
    } else {
      seen.set(keyValue, rowIndex);
    }
  }

  return errors;
}

export function validateUnique (env: InterpreterDatabase): CompileError[] {
  const errors: CompileError[] = [];

  for (const [table, rows] of env.records) {
    const mergedTable = mergeTableAndPartials(table, env);
    if (rows.length === 0) continue;

    const uniqueConstraints = collectUniqueConstraints(mergedTable);
    const columnMap = new Map(mergedTable.fields.map((c) => [c.name, c]));

    for (const uniqueColumns of uniqueConstraints) {
      const uniqueColumnFields = uniqueColumns.map((col) => columnMap.get(col)).filter(Boolean);
      errors.push(...checkUniqueDuplicates(rows, uniqueColumns, uniqueColumnFields, mergedTable));
    }
  }

  return errors;
}
