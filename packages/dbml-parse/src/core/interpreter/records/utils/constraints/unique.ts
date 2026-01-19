import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase } from '@/core/interpreter/types';
import {
  extractKeyValueWithDefault,
  hasNullInKey,
  formatColumns,
} from './helper';
import { mergeTableAndPartials } from '@/core/interpreter/utils';
import { uniqueDuplicateMessage } from './messages';

export function validateUnique (
  env: InterpreterDatabase,
): CompileError[] {
  const errors: CompileError[] = [];

  for (const [table, rows] of env.records) {
    const mergedTable = mergeTableAndPartials(table, env);
    if (rows.length === 0) continue;

    const uniqueConstraints: string[][] = [];
    for (const field of mergedTable.fields) {
      if (field.unique) {
        uniqueConstraints.push([field.name]);
      }
    }
    for (const index of mergedTable.indexes) {
      if (index.unique) {
        uniqueConstraints.push(index.columns.map((c) => c.value));
      }
    }

    // Collect all unique column names from all rows
    const columnsSet = new Set<string>();
    for (const row of rows) {
      for (const colName of Object.keys(row.values)) {
        columnsSet.add(colName);
      }
    }
    const columnMap = new Map(mergedTable.fields.map((c) => [c.name, c]));

    for (const uniqueColumns of uniqueConstraints) {
      const uniqueColumnFields = uniqueColumns.map((col) => columnMap.get(col)).filter(Boolean);

      const isComposite = uniqueColumns.length > 1;
      const columnsStr = formatColumns(uniqueColumns);
      const seen = new Map<string, number>(); // key -> first row index

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];

        const hasNull = hasNullInKey(row.values, uniqueColumns, uniqueColumnFields);

        // NULL values are allowed in unique constraints and don't conflict
        if (hasNull) {
          continue;
        }

        const keyValue = extractKeyValueWithDefault(row.values, uniqueColumns, uniqueColumnFields);
        if (seen.has(keyValue)) {
          const errorNode = row.columnNodes[uniqueColumns[0]] || row.node;
          const valueMap = new Map<string, unknown>();
          for (const col of uniqueColumns) {
            valueMap.set(col, row.values[col]?.value);
          }
          const msg = uniqueDuplicateMessage(mergedTable.schemaName, mergedTable.name, uniqueColumns, valueMap);
          errors.push(new CompileError(CompileErrorCode.INVALID_RECORDS_FIELD, msg, errorNode));
        } else {
          seen.set(keyValue, rowIndex);
        }
      }
    }
  }

  return errors;
}
