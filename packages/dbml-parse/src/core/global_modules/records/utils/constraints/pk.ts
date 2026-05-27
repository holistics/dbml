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
  const areAllAutoIncrement = pkColumnFields.every((col) => col && isAutoIncrementColumn(col));

  const [
    rowsWithNull,
    rowsWithoutNull,
  ] = partition(
    rows,
    (row) => hasNullWithoutDefaultInKey(row, pkColumns, pkColumnFields),
  );

  // NULL in PK only errors when not all columns are auto-increment
  const nullErrors = areAllAutoIncrement
    ? []
    : createNullErrors(compiler, rowsWithNull, pkColumns, schemaName, tableName);

  const duplicateErrors = findDuplicateErrors(compiler, rowsWithoutNull, pkColumns, pkColumnFields, schemaName, tableName);

  return [
    ...nullErrors,
    ...duplicateErrors,
  ];
}

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

  return flatMap(rowsWithNull, (row) =>
    pkColumns.map((col) => createConstraintWarning(compiler, row[col], message)),
  );
}

function findDuplicateErrors (
  compiler: Compiler,
  rows: Record<string, RecordValue>[],
  pkColumns: string[],
  pkColumnFields: ColumnInfo[],
  schemaName: string | null,
  tableName: string,
): CompileWarning[] {
  // Group rows by their PK value
  const rowsByKeyValue = groupBy(rows, (row) => extractKeyValueWithDefault(row, pkColumns, pkColumnFields));

  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(pkColumns.length);
    const columnRef = formatFullColumnNames(schemaName, tableName, pkColumns);

    return flatMap(duplicateRows, (row) => {
      const valueStr = formatValues(row, pkColumns);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return pkColumns.map((col) => createConstraintWarning(compiler, row[col], message));
    });
  });
}

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
