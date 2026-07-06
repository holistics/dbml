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
import { TableSymbol, type ColumnSymbol } from '@/core/types/symbol';
import {
  createConstraintWarning,
  extractKeyValueWithDefault,
  formatFullColumnNames,
  formatValues,
  getDiagnosticAnchorValues,
  hasNullWithoutDefaultInKey,
  toKeyedRows,
} from './helper';

const getConstraintType = (columnCount: number) =>
  columnCount > 1 ? 'Composite PK' : 'PK';

// Validate primary key constraints for a table's records.
export function validatePrimaryKey (compiler: Compiler, tableSymbol: TableSymbol, recordBlock: SyntaxNode, record: TableRecord): CompileWarning[] {
  if (isEmpty(record.values)) return [];

  const pkConstraints = collectPkConstraints(tableSymbol, compiler);

  return flatMap(pkConstraints, (pkColumnSymbols) =>
    validatePkConstraint(compiler, tableSymbol, recordBlock, pkColumnSymbols, record),
  );
}

// Validate a single PK constraint (single or composite) against all rows.
// Returns warnings for missing columns, null values, and duplicates.
function validatePkConstraint (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  recordBlock: SyntaxNode,
  pkColumnSymbols: ColumnSymbol[],
  record: TableRecord,
): CompileWarning[] {
  const rows = toKeyedRows(record);

  const missingErrors = checkMissingPkColumns(compiler, tableSymbol, recordBlock, pkColumnSymbols, record);
  if (!isEmpty(missingErrors)) return missingErrors;

  // Only check null for PK columns that are not auto-increment and have no default
  const nullCheckSymbols = pkColumnSymbols.filter((col) =>
    !col.increment(compiler) && !col.default(compiler),
  );

  const [
    rowsWithNull,
    rowsWithoutNull,
  ] = partition(
    rows,
    (row) => hasNullWithoutDefaultInKey(compiler, row, nullCheckSymbols),
  );

  const nullErrors = createNullErrors(compiler, tableSymbol, nullCheckSymbols.map((c) => c.name ?? ''), rowsWithNull);

  // If any PK column is auto-increment, the whole key is guaranteed unique
  const hasAutoIncrement = pkColumnSymbols.some((col) => col.increment(compiler));
  const duplicateErrors = hasAutoIncrement
    ? []
    : findDuplicateErrors(compiler, tableSymbol, pkColumnSymbols, rowsWithoutNull);

  return [
    ...nullErrors,
    ...duplicateErrors,
  ];
}

// Create warnings for rows that have NULL in PK columns.
// Returns one warning per specified PK column per row.
function createNullErrors (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  pkColumns: string[],
  rowsWithNull: Record<string, RecordValue>[],
): CompileWarning[] {
  if (isEmpty(rowsWithNull)) return [];

  const schemaName = tableSymbol.schema(compiler);
  const tableName = tableSymbol.name ?? '';
  const constraintType = getConstraintType(pkColumns.length);
  const columnRef = formatFullColumnNames(schemaName, tableName, pkColumns);
  const message = `NULL in ${constraintType}: ${columnRef} cannot be NULL`;

  return flatMap(rowsWithNull, (row) =>
    getDiagnosticAnchorValues(row, pkColumns).map((v) => createConstraintWarning(compiler, v, message)),
  );
}

// Find rows with duplicate PK values.
// Returns warnings for each duplicate row.
function findDuplicateErrors (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  pkColumnSymbols: ColumnSymbol[],
  rows: Record<string, RecordValue>[],
): CompileWarning[] {
  const pkColumns = pkColumnSymbols.map((c) => c.name ?? '');
  const schemaName = tableSymbol.schema(compiler);
  const tableName = tableSymbol.name ?? '';

  const rowsByKeyValue = groupBy(rows, (row) => extractKeyValueWithDefault(compiler, row, pkColumnSymbols));
  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(pkColumns.length);
    const columnRef = formatFullColumnNames(schemaName, tableName, pkColumns);

    return flatMap(duplicateRows, (row) => {
      const valueStr = formatValues(compiler, row, pkColumnSymbols);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return getDiagnosticAnchorValues(row, pkColumns).map((v) => createConstraintWarning(compiler, v, message));
    });
  });
}

// Check if any PK columns are missing from the record column list.
// Returns warnings if missing columns have no default or auto-increment.
function checkMissingPkColumns (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  recordBlock: SyntaxNode,
  pkColumnSymbols: ColumnSymbol[],
  record: TableRecord,
): CompileWarning[] {
  const pkColumns = pkColumnSymbols.map((c) => c.name ?? '');
  const availableColumns = new Set(record.columns);
  const schemaName = tableSymbol.schema(compiler);
  const tableName = tableSymbol.name ?? '';

  const missingColumns = difference(pkColumns, Array.from(availableColumns));
  if (isEmpty(missingColumns)) return [];

  const missingSet = new Set(missingColumns);
  const missingSymbols = pkColumnSymbols.filter((c) => missingSet.has(c.name ?? ''));
  const missingWithoutDefaults = missingSymbols
    .filter((col) => !col.increment(compiler) && !col.default(compiler))
    .map((c) => c.name ?? '');
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
// Returns an array of ColumnSymbol arrays: single-column PKs and composite PKs from indexes.
function collectPkConstraints (tableSymbol: TableSymbol, compiler: Compiler): ColumnSymbol[][] {
  const columns = tableSymbol.mergedColumns(compiler);
  const columnSymbolMap = keyBy(columns, (c) => c.name ?? '');

  return [
    ...columns.filter((col) => col.pk(compiler)).map((col) => [
      col,
    ]),
    ...tableSymbol.mergedIndexes(compiler).flatMap((index) => {
      const result = compiler.interpretMetadata(index, index.declaration.filepath).getValue();
      if (!Array.isArray(result)) return [];
      return (result as Index[]).filter((e) => e.pk).map((e) => compact(e.columns.map((c) => columnSymbolMap[c.value])));
    }),
  ];
}
