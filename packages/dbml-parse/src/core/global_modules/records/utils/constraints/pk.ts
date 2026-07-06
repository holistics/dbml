import {
  compact, difference, flatMap, filter, groupBy, isEmpty, keyBy, partition,
} from 'lodash-es';
import type Compiler from '@/compiler/index';
import { CompileErrorCode, CompileWarning } from '@/core/types/errors';
import type { SyntaxNode } from '@/core/types/nodes';
import type {
  Index,
  RecordValue,
  TableRecord,
} from '@/core/types/schemaJson';
import { TableSymbol } from '@/core/types/symbol';
import {
  type ColumnInfo,
  columnInfoFromSymbol,
  createConstraintWarning,
  extractKeyValueWithDefault,
  formatFullColumnNames,
  formatValues,
  hasNullWithoutDefaultInKey,
  isAutoIncrementColumn,
  toKeyedRows,
} from './helper';

const getConstraintType = (columnCount: number) =>
  columnCount > 1 ? 'Composite PK' : 'PK';

// Validate primary key constraints for a table's records.
export function validatePrimaryKey (compiler: Compiler, tableSymbol: TableSymbol, recordBlock: SyntaxNode, record: TableRecord): CompileWarning[] {
  if (isEmpty(record.values)) return [];

  const columns = tableSymbol.mergedColumns(compiler);
  const columnInfos = columns.map((c) => columnInfoFromSymbol(c, compiler));
  const columnMap = keyBy(columnInfos, 'name');

  const rows = toKeyedRows(record);
  const pkConstraints = collectPkConstraints(tableSymbol, columnInfos, compiler);
  const availableColumns = new Set(record.columns);

  return flatMap(pkConstraints, (pkColumns) =>
    validatePkConstraint(compiler, tableSymbol, recordBlock, pkColumns, rows, availableColumns, columnMap, record),
  );
}

// Validate a single PK constraint (single or composite) against all rows.
// Returns warnings for missing columns, null values, and duplicates.
function validatePkConstraint (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  recordBlock: SyntaxNode,
  pkColumns: string[],
  rows: Record<string, RecordValue>[],
  availableColumns: Set<string>,
  columnMap: Record<string, ColumnInfo>,
  record: TableRecord,
): CompileWarning[] {
  const schemaName = tableSymbol.schema(compiler);
  const tableName = tableSymbol.name ?? '';

  const missingErrors = checkMissingPkColumns(recordBlock, pkColumns, availableColumns, columnMap, schemaName, tableName, record);
  if (!isEmpty(missingErrors)) return missingErrors;

  const pkColumnFields = compact(pkColumns.map((col) => columnMap[col]));

  // Only check null for PK columns that are not auto-increment and have no default
  const nullCheckColumns = pkColumns.filter((col) => {
    const field = columnMap[col];
    return field && !isAutoIncrementColumn(field) && !field.dbdefault;
  });
  const nullCheckFields = compact(nullCheckColumns.map((col) => columnMap[col]));

  const [
    rowsWithNull,
    rowsWithoutNull,
  ] = partition(
    rows,
    (row) => hasNullWithoutDefaultInKey(row, nullCheckColumns, nullCheckFields),
  );

  const nullErrors = createNullErrors(compiler, rowsWithNull, nullCheckColumns, schemaName, tableName);

  // If any PK column is auto-increment, the whole key is guaranteed unique
  const hasAutoIncrement = pkColumnFields.some((col) => isAutoIncrementColumn(col));
  const duplicateErrors = hasAutoIncrement
    ? []
    : findDuplicateErrors(compiler, rowsWithoutNull, pkColumns, pkColumnFields, schemaName, tableName);

  return [
    ...nullErrors,
    ...duplicateErrors,
  ];
}

// Create warnings for rows that have NULL in PK columns.
// Returns one warning per specified PK column per row.
function createNullErrors (
  compiler: Compiler,
  rowsWithNull: Record<string, RecordValue>[],
  pkColumns: string[],
  schemaName: string | null,
  tableName: string,
): CompileWarning[] {
  if (isEmpty(rowsWithNull)) return [];

  const constraintType = getConstraintType(pkColumns.length);
  const columnRef = formatFullColumnNames(schemaName, tableName, pkColumns);
  const message = `NULL in ${constraintType}: ${columnRef} cannot be NULL`;

  return flatMap(rowsWithNull, (row) => {
    const presentCols = pkColumns.filter((col) => row[col]);
    // If PK column is present, anchor warning on it; otherwise span all columns in the row
    const anchors = presentCols.length > 0
      ? presentCols.map((col) => row[col])
      : Object.values(row).filter(Boolean);
    return anchors.map((v) => createConstraintWarning(compiler, v, message));
  });
}

// Find rows with duplicate PK values.
// Returns warnings for each duplicate row.
function findDuplicateErrors (
  compiler: Compiler,
  rows: Record<string, RecordValue>[],
  pkColumns: string[],
  pkColumnFields: ColumnInfo[],
  schemaName: string | null,
  tableName: string,
): CompileWarning[] {
  const rowsByKeyValue = groupBy(rows, (row) => extractKeyValueWithDefault(row, pkColumns, pkColumnFields));
  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(pkColumns.length);
    const columnRef = formatFullColumnNames(schemaName, tableName, pkColumns);

    return flatMap(duplicateRows, (row) => {
      const valueStr = formatValues(row, pkColumns, pkColumnFields);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      const presentCols = pkColumns.filter((col) => row[col]);
      // If PK column is present, anchor warning on it; otherwise span all columns in the row
      const anchors = presentCols.length > 0
        ? presentCols.map((col) => row[col])
        : Object.values(row).filter(Boolean);
      return anchors.map((v) => createConstraintWarning(compiler, v, message));
    });
  });
}

// Check if any PK columns are missing from the record column list.
// Returns warnings if missing columns have no default or auto-increment.
function checkMissingPkColumns (
  recordBlock: SyntaxNode,
  pkColumns: string[],
  availableColumns: Set<string>,
  columnMap: Record<string, ColumnInfo>,
  schemaName: string | null,
  tableName: string,
  record: TableRecord,
): CompileWarning[] {
  const missingColumns = difference(pkColumns, Array.from(availableColumns));
  if (isEmpty(missingColumns)) return [];

  const missingWithoutDefaults = missingColumns.filter((colName) => {
    const col = columnMap[colName];
    return !!(col && !isAutoIncrementColumn(col) && !col.dbdefault);
  });
  if (isEmpty(missingWithoutDefaults)) return [];

  const constraintType = getConstraintType(missingWithoutDefaults.length);
  const columnRef = formatFullColumnNames(schemaName, tableName, missingWithoutDefaults);
  const message = `${constraintType}: Column ${columnRef} is missing from record and has no default value`;

  return record.values.map(() => new CompileWarning(
    CompileErrorCode.INVALID_RECORDS_FIELD,
    message,
    recordBlock,
  ));
}

// Collect all PK constraints for a table.
// Returns an array of column name arrays: single-column PKs and composite PKs from indexes.
function collectPkConstraints (tableSymbol: TableSymbol, columnInfos: ColumnInfo[], compiler: Compiler): string[][] {
  return [
    ...columnInfos.filter((col) => col.pk).map((col) => [
      col.name,
    ]),
    ...tableSymbol.mergedIndexes(compiler).flatMap((index) => {
      const result = compiler.interpretMetadata(index, index.declaration.filepath).getValue();
      if (!Array.isArray(result)) return [];
      return (result as Index[]).filter((e) => e.pk).map((e) => e.columns.map((c) => c.value));
    }),
  ];
}
