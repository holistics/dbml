import { CompileError, CompileErrorCode } from '@/core/errors';
import { TableRecord } from '@/core/interpreter/types';
import { FunctionApplicationNode } from '@/core/parser/nodes';
import { ColumnSchema } from '../../../records/types';
import {
  extractKeyValue,
  extractKeyValueWithDefaults,
  getColumnIndices,
  hasNullInKey,
  formatColumns,
  isAutoIncrementColumn,
  hasNotNullWithDefault,
} from './helper';

// Validate primary key constraints for a table
export function validatePrimaryKey (
  tableRecord: TableRecord,
  pkConstraints: string[][],
  rowNodes: FunctionApplicationNode[],
  columnSchemas: ColumnSchema[],
): CompileError[] {
  const errors: CompileError[] = [];
  const { columns, values } = tableRecord;
  const schemaMap = new Map(columnSchemas.map((c) => [c.name, c]));

  for (const pkColumns of pkConstraints) {
    const indices = getColumnIndices(columns, pkColumns);
    const missingColumns = pkColumns.filter((_, i) => indices[i] === -1);

    // If PK column is missing from record, every row violates the constraint
    if (missingColumns.length > 0) {
      const missingStr = formatColumns(missingColumns);
      for (const rowNode of rowNodes) {
        errors.push(new CompileError(
          CompileErrorCode.INVALID_RECORDS_FIELD,
          `Missing primary key column ${missingStr} in record`,
          rowNode,
        ));
      }
      continue;
    }

    const pkColumnSchemas = pkColumns.map((col) => schemaMap.get(col));

    // Check if ALL pk columns are auto-increment (serial/increment)
    // Only then can we skip NULL checks and treat nulls as unique
    const allAutoIncrement = pkColumnSchemas.every((schema) => schema && isAutoIncrementColumn(schema));

    // Check if ANY pk column has not null + dbdefault
    // In this case, NULL values will resolve to the default, so check for duplicates
    const hasDefaultConstraint = pkColumnSchemas.some((schema) => schema && hasNotNullWithDefault(schema));

    const isComposite = pkColumns.length > 1;
    const columnsStr = formatColumns(pkColumns);
    const seen = new Map<string, number>(); // key -> first row index

    for (let rowIndex = 0; rowIndex < values.length; rowIndex++) {
      const row = values[rowIndex];
      const rowNode = rowNodes[rowIndex];

      // Check for NULL in PK
      const hasNull = hasNullInKey(row, indices);
      if (hasNull) {
        // Auto-increment columns can have NULL - each gets a unique value from DB
        // Skip duplicate checking for this row (will be unique)
        if (allAutoIncrement) {
          continue;
        }
        if (hasDefaultConstraint) {
          // Has not null + dbdefault: NULL resolves to default value
          // Check for duplicates using resolved default values
          const keyValue = extractKeyValueWithDefaults(row, indices, pkColumnSchemas);
          if (seen.has(keyValue)) {
            const msg = isComposite
              ? `Duplicate composite primary key value for ${columnsStr}`
              : `Duplicate primary key value for column ${columnsStr}`;
            errors.push(new CompileError(CompileErrorCode.INVALID_RECORDS_FIELD, msg, rowNode));
          } else {
            seen.set(keyValue, rowIndex);
          }
          continue;
        } else {
          // Non-auto-increment PK columns without default cannot have NULL
          const msg = isComposite
            ? `NULL value not allowed in composite primary key ${columnsStr}`
            : `NULL value not allowed in primary key column ${columnsStr}`;
          errors.push(new CompileError(CompileErrorCode.INVALID_RECORDS_FIELD, msg, rowNode));
          continue;
        }
      }

      // Check for duplicates
      const keyValue = hasDefaultConstraint
        ? extractKeyValueWithDefaults(row, indices, pkColumnSchemas)
        : extractKeyValue(row, indices);
      if (seen.has(keyValue)) {
        const msg = isComposite
          ? `Duplicate composite primary key value for ${columnsStr}`
          : `Duplicate primary key value for column ${columnsStr}`;
        errors.push(new CompileError(CompileErrorCode.INVALID_RECORDS_FIELD, msg, rowNode));
      } else {
        seen.set(keyValue, rowIndex);
      }
    }
  }

  return errors;
}
