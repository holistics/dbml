import { CompileError, CompileErrorCode } from '@/core/errors';
import { TableRecord } from '@/core/interpreter/types';
import { FunctionApplicationNode } from '@/core/parser/nodes';
import { ColumnSchema } from '../../types';
import {
  extractKeyValue,
  extractKeyValueWithDefaults,
  getColumnIndices,
  hasNullInKey,
  formatColumns,
  hasNotNullWithDefault,
} from './helper';

// Validate unique constraints for a table
export function validateUnique (
  tableRecord: TableRecord,
  uniqueConstraints: string[][],
  rowNodes: FunctionApplicationNode[],
  columnSchemas: ColumnSchema[],
): CompileError[] {
  const errors: CompileError[] = [];
  const { columns, values } = tableRecord;
  const schemaMap = new Map(columnSchemas.map((c) => [c.name, c]));

  for (const uniqueColumns of uniqueConstraints) {
    const indices = getColumnIndices(columns, uniqueColumns);
    if (indices.some((i) => i === -1)) continue; // Column not found, skip

    const uniqueColumnSchemas = uniqueColumns.map((col) => schemaMap.get(col));

    // Check if ANY unique column has not null + dbdefault
    // In this case, NULL values will resolve to the default, so check for duplicates
    const hasDefaultConstraint = uniqueColumnSchemas.some((schema) => schema && hasNotNullWithDefault(schema));

    const isComposite = uniqueColumns.length > 1;
    const columnsStr = formatColumns(uniqueColumns);
    const seen = new Map<string, number>(); // key -> first row index

    for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      const rowNode = rowNodes[rowIndex];

      const hasNull = hasNullInKey(row, indices);

      // NULL values are allowed in unique constraints and don't conflict
      // UNLESS the column has not null + dbdefault (NULL resolves to same default)
      if (hasNull) {
        if (hasDefaultConstraint) {
          // NULL resolves to default value, check for duplicates
          const keyValue = extractKeyValueWithDefaults(row, indices, uniqueColumnSchemas);
          if (seen.has(keyValue)) {
            const msg = isComposite
              ? `Duplicate composite unique constraint value for ${columnsStr}`
              : `Duplicate unique value for column ${columnsStr}`;
            errors.push(new CompileError(CompileErrorCode.INVALID_RECORDS_FIELD, msg, rowNode));
          } else {
            seen.set(keyValue, rowIndex);
          }
        }
        // If no default constraint, NULL values don't conflict, skip
        continue;
      }

      // Check for duplicates
      const keyValue = hasDefaultConstraint
        ? extractKeyValueWithDefaults(row, indices, uniqueColumnSchemas)
        : extractKeyValue(row, indices);
      if (seen.has(keyValue)) {
        const msg = isComposite
          ? `Duplicate composite unique constraint value for ${columnsStr}`
          : `Duplicate unique value for column ${columnsStr}`;
        errors.push(new CompileError(CompileErrorCode.INVALID_RECORDS_FIELD, msg, rowNode));
      } else {
        seen.set(keyValue, rowIndex);
      }
    }
  }

  return errors;
}
