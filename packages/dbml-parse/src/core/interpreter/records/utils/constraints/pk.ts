import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase } from '@/core/interpreter/types';
import {
  extractKeyValue,
  hasNullInKey,
  formatColumns,
  isAutoIncrementColumn,
} from './helper';

export function validatePrimaryKey (
  env: InterpreterDatabase,
): CompileError[] {
  const errors: CompileError[] = [];

  for (const [table, rows] of env.records) {
    if (rows.length === 0) continue;

    // Extract PK constraints
    const pkConstraints: string[][] = [];
    for (const field of table.fields) {
      if (field.pk) {
        pkConstraints.push([field.name]);
      }
    }
    for (const index of table.indexes) {
      if (index.pk) {
        pkConstraints.push(index.columns.map((c) => c.value));
      }
    }

    // Collect all unique column names from all rows
    const columnsSet = new Set<string>();
    for (const row of rows) {
      for (const colName of Object.keys(row.values)) {
        columnsSet.add(colName);
      }
    }
    const columns = Array.from(columnsSet);
    const columnMap = new Map(table.fields.map((c) => [c.name, c]));

    for (const pkColumns of pkConstraints) {
      const missingColumns = pkColumns.filter((col) => !columns.includes(col));
      const pkColumnFields = pkColumns.map((col) => columnMap.get(col)).filter(Boolean);

      // If PK column is completely missing from records, check if it has default/autoincrement
      if (missingColumns.length > 0) {
        const missingColumnsWithoutDefaults = missingColumns.filter((colName) => {
          const col = columnMap.get(colName);
          // Allow missing only if column has autoincrement or has a default value
          return col && !col.increment && !col.dbdefault;
        });

        // Report error for missing columns without defaults/autoincrement
        if (missingColumnsWithoutDefaults.length > 0) {
          const missingStr = formatColumns(missingColumnsWithoutDefaults);
          for (const row of rows) {
            errors.push(new CompileError(
              CompileErrorCode.INVALID_RECORDS_FIELD,
              `Missing primary key column ${missingStr} in record`,
              row.node,
            ));
          }
        }
        continue;
      }

      // Check if ALL pk columns are auto-increment (serial/increment)
      // Only then can we skip NULL checks and treat nulls as unique
      const allAutoIncrement = pkColumnFields.every((col) => col && isAutoIncrementColumn(col));

      const isComposite = pkColumns.length > 1;
      const columnsStr = formatColumns(pkColumns);
      const seen = new Map<string, number>(); // key -> first row index

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];

        // Check for NULL in PK (considering defaults)
        const hasNull = hasNullInKey(row.values, pkColumns, pkColumnFields);
        if (hasNull) {
          // Auto-increment columns can have NULL - each gets a unique value from DB
          // Skip duplicate checking for this row (will be unique)
          if (allAutoIncrement) {
            continue;
          }
          // Non-auto-increment PK columns cannot have NULL (even with defaults)
          const msg = isComposite
            ? `NULL value not allowed in composite primary key ${columnsStr}`
            : `NULL value not allowed in primary key column ${columnsStr}`;
          errors.push(new CompileError(CompileErrorCode.INVALID_RECORDS_FIELD, msg, row.node));
          continue;
        }

        // Check for duplicates (using defaults for missing values)
        const keyValue = extractKeyValue(row.values, pkColumns, pkColumnFields);
        if (seen.has(keyValue)) {
          const msg = isComposite
            ? `Duplicate composite primary key value for ${columnsStr}`
            : `Duplicate primary key value for column ${columnsStr}`;
          errors.push(new CompileError(CompileErrorCode.INVALID_RECORDS_FIELD, msg, row.node));
        } else {
          seen.set(keyValue, rowIndex);
        }
      }
    }
  }

  return errors;
}
