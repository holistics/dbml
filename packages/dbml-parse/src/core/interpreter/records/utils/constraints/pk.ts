import { CompileError, CompileErrorCode } from '@/core/errors';
import { InterpreterDatabase } from '@/core/interpreter/types';
import {
  extractKeyValueWithDefault,
  hasNullInKey,
  isAutoIncrementColumn,
  formatFullColumnNames,
} from './helper';
import { mergeTableAndPartials } from '@/core/interpreter/utils';

export function validatePrimaryKey (
  env: InterpreterDatabase,
): CompileError[] {
  const errors: CompileError[] = [];

  for (const [table, rows] of env.records) {
    const mergedTable = mergeTableAndPartials(table, env);
    if (rows.length === 0) continue;

    const pkConstraints: string[][] = [];
    for (const field of mergedTable.fields) {
      if (field.pk) {
        pkConstraints.push([field.name]);
      }
    }
    for (const index of mergedTable.indexes) {
      if (index.pk) {
        pkConstraints.push(index.columns.map((c) => c.value));
      }
    }

    const columnsSet = new Set<string>();
    for (const row of rows) {
      for (const colName of Object.keys(row.values)) {
        columnsSet.add(colName);
      }
    }
    const columns = Array.from(columnsSet);
    const columnMap = new Map(mergedTable.fields.map((c) => [c.name, c]));

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
          const isComposite = missingColumnsWithoutDefaults.length > 1;
          const constraintType = isComposite ? 'Composite PK' : 'PK';
          const columnRef = formatFullColumnNames(mergedTable.schemaName, mergedTable.name, missingColumnsWithoutDefaults);
          const msg = `${constraintType}: Column ${columnRef} is missing from record and has no default value`;
          for (const row of rows) {
            // Create separate error for each column in the constraint
            const errorNodes = pkColumns
              .map((col) => row.columnNodes[col])
              .filter(Boolean);

            if (errorNodes.length > 0) {
              // Create one error per column node
              for (const node of errorNodes) {
                errors.push(new CompileError(
                  CompileErrorCode.INVALID_RECORDS_FIELD,
                  msg,
                  node,
                ));
              }
            } else {
              // Fallback to row node if no column nodes available
              errors.push(new CompileError(
                CompileErrorCode.INVALID_RECORDS_FIELD,
                msg,
                row.node,
              ));
            }
          }
        }
        continue;
      }

      // Check if ALL pk columns are auto-increment (serial/increment)
      // Only then can we skip NULL checks and treat nulls as unique
      const allAutoIncrement = pkColumnFields.every((col) => col && isAutoIncrementColumn(col));

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
          // Create separate error for each column in the constraint
          const errorNodes = pkColumns
            .map((col) => row.columnNodes[col])
            .filter(Boolean);
          const isComposite = pkColumns.length > 1;
          const constraintType = isComposite ? 'Composite PK' : 'PK';
          const columnRef = formatFullColumnNames(mergedTable.schemaName, mergedTable.name, pkColumns);
          const msg = `NULL in ${constraintType}: ${columnRef} cannot be NULL`;

          if (errorNodes.length > 0) {
            // Create one error per column node
            for (const node of errorNodes) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_RECORDS_FIELD,
                msg,
                node,
              ));
            }
          } else {
            // Fallback to row node if no column nodes available
            errors.push(new CompileError(
              CompileErrorCode.INVALID_RECORDS_FIELD,
              msg,
              row.node,
            ));
          }
          continue;
        }

        // Check for duplicates (using defaults for missing values)
        const keyValue = extractKeyValueWithDefault(row.values, pkColumns, pkColumnFields);
        if (seen.has(keyValue)) {
          // Create separate error for each column in the constraint
          const errorNodes = pkColumns
            .map((col) => row.columnNodes[col])
            .filter(Boolean);
          const isComposite = pkColumns.length > 1;
          const constraintType = isComposite ? 'Composite PK' : 'PK';
          const columnRef = formatFullColumnNames(mergedTable.schemaName, mergedTable.name, pkColumns);

          let msg: string;
          if (isComposite) {
            const valueStr = pkColumns.map((col) => JSON.stringify(row.values[col]?.value)).join(', ');
            msg = `Duplicate ${constraintType}: ${columnRef} = (${valueStr})`;
          } else {
            const value = JSON.stringify(row.values[pkColumns[0]]?.value);
            msg = `Duplicate ${constraintType}: ${columnRef} = ${value}`;
          }

          if (errorNodes.length > 0) {
            // Create one error per column node
            for (const node of errorNodes) {
              errors.push(new CompileError(
                CompileErrorCode.INVALID_RECORDS_FIELD,
                msg,
                node,
              ));
            }
          } else {
            // Fallback to row node if no column nodes available
            errors.push(new CompileError(
              CompileErrorCode.INVALID_RECORDS_FIELD,
              msg,
              row.node,
            ));
          }
        } else {
          seen.set(keyValue, rowIndex);
        }
      }
    }
  }

  return errors;
}
