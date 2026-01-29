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

export function validatePrimaryKey (env: InterpreterDatabase): CompileError[] {
  const errors: CompileError[] = [];

  for (const [table, rows] of env.records) {
    if (rows.length === 0) continue;

    if (!env.cachedMergedTables.has(table)) {
      env.cachedMergedTables.set(table, mergeTableAndPartials(table, env));
    }
    const mergedTable = env.cachedMergedTables.get(table)!;

    const pkConstraints = collectPkConstraints(mergedTable);
    const availableColumns = collectAvailableColumns(rows);
    const columnMap = new Map(mergedTable.fields.map((c) => [c.name, c]));

    for (const pkColumns of pkConstraints) {
      const missingErrors = checkMissingPkColumns(pkColumns, availableColumns, columnMap, mergedTable, rows);
      if (missingErrors.length > 0) {
        errors.push(...missingErrors);
        continue;
      }

      const pkColumnFields = pkColumns.map((col) => columnMap.get(col)).filter(Boolean);

      const areAllColumnsAutoIncrement = pkColumnFields.every((col) => col && isAutoIncrementColumn(col));

      const seenValueIndexes = new Map<string, number>();

      for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
        const row = rows[rowIndex];

        // NULL in PK is allowed only when all PK columns auto-generate unique values
        const hasNull = hasNullWithoutDefaultInKey(row.values, pkColumns, pkColumnFields);
        if (hasNull) {
          if (areAllColumnsAutoIncrement) continue;

          // Prepare error message
          const constraintType = pkColumns.length > 1 ? 'Composite PK' : 'PK';
          const columnRef = formatFullColumnNames(mergedTable.schemaName, mergedTable.name, pkColumns);
          const message = `NULL in ${constraintType}: ${columnRef} cannot be NULL`;
          errors.push(...createConstraintErrors(row, pkColumns, message));
          continue;
        }

        // Check uniqueness by comparing serialized key values
        const keyValue = extractKeyValueWithDefault(row.values, pkColumns, pkColumnFields);
        if (seenValueIndexes.has(keyValue)) {
          // Prepare error message
          const constraintType = pkColumns.length > 1 ? 'Composite PK' : 'PK';
          const columnRef = formatFullColumnNames(mergedTable.schemaName, mergedTable.name, pkColumns);
          const valueStr = formatValues(row.values, pkColumns);
          const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;

          errors.push(...createConstraintErrors(row, pkColumns, message));
          continue;
        }
        seenValueIndexes.set(keyValue, rowIndex);
      }
    }
  }

  return errors;
}

function collectPkConstraints (mergedTable: Table): string[][] {
  const pkConstraints: string[][] = [];

  for (const field of mergedTable.fields) {
    if (field.pk) pkConstraints.push([field.name]);
  }

  for (const index of mergedTable.indexes) {
    if (index.pk) pkConstraints.push(index.columns.map((c) => c.value));
  }

  return pkConstraints;
}

function collectAvailableColumns (rows: TableRecordRow[]): Set<string> {
  const columnsSet = new Set<string>();
  for (const row of rows) {
    for (const colName of Object.keys(row.values)) {
      columnsSet.add(colName);
    }
  }
  return columnsSet;
}

function checkMissingPkColumns (
  pkColumns: string[],
  availableColumns: Set<string>,
  columnMap: Map<string, Column>,
  mergedTable: Table,
  rows: TableRecordRow[],
): CompileError[] {
  const missingColumns = pkColumns.filter((col) => !availableColumns.has(col));
  if (missingColumns.length === 0) return [];

  // Missing PK columns are acceptable if DB can provide values (auto-increment/serial/default)
  const missingWithoutDefaults = missingColumns.filter((colName) => {
    const col = columnMap.get(colName);
    return col && !col.increment && !isSerialType(col.type.type_name) && !col.dbdefault;
  });

  if (missingWithoutDefaults.length === 0) return [];

  const constraintType = missingWithoutDefaults.length > 1 ? 'Composite PK' : 'PK';
  const columnRef = formatFullColumnNames(mergedTable.schemaName, mergedTable.name, missingWithoutDefaults);
  const message = `${constraintType}: Column ${columnRef} is missing from record and has no default value`;

  return rows.map((row) => new CompileError(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    message,
    row.node,
  ));
}
