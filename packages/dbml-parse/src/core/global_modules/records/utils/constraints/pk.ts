import {
  compact, difference, flatMap, filter, groupBy, isEmpty, keyBy, partition,
} from 'lodash-es';
import type Compiler from '@/compiler/index';
import type { CompileInfo } from '@/core/types/errors';
import {
  recordsPkNull,
  recordsPkDuplicate,
  recordsPkMissing,
} from '@/core/utils/diagnostics_reporter';
import type { SyntaxNode } from '@/core/types/nodes';
import type {
  Index,
  RecordValue,
  TableRecord,
} from '@/core/types/schemaJson';
import { TableSymbol, type ColumnSymbol } from '@/core/types/symbol';
import {
  resolveRecordValueNode,
  extractKeyValueWithDefault,
  formatValues,
  getDiagnosticAnchorValues,
  hasNullWithoutDefaultInKey,
  toKeyedRows,
} from './helper';

// Validate primary key constraints for a table's records.
export function validatePrimaryKey (compiler: Compiler, tableSymbol: TableSymbol, recordBlock: SyntaxNode, record: TableRecord): CompileInfo[] {
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
): CompileInfo[] {
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

  const nullErrors = createNullErrors(compiler, tableSymbol, nullCheckSymbols, rowsWithNull);

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
  pkColumnSymbols: ColumnSymbol[],
  rowsWithNull: Record<string, RecordValue>[],
): CompileInfo[] {
  if (isEmpty(rowsWithNull)) return [];

  const pkColumns = pkColumnSymbols.map((c) => c.name ?? '');
  return flatMap(rowsWithNull, (row) =>
    getDiagnosticAnchorValues(row, pkColumns).map((v) =>
      recordsPkNull(compiler, resolveRecordValueNode(compiler, v), { table: tableSymbol, columns: pkColumnSymbols })),
  );
}

// Find rows with duplicate PK values.
// Returns warnings for each duplicate row.
function findDuplicateErrors (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  pkColumnSymbols: ColumnSymbol[],
  rows: Record<string, RecordValue>[],
): CompileInfo[] {
  const pkColumns = pkColumnSymbols.map((c) => c.name ?? '');

  const rowsByKeyValue = groupBy(rows, (row) => extractKeyValueWithDefault(compiler, row, pkColumnSymbols));
  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  return flatMap(duplicateGroups, (duplicateRows) =>
    flatMap(duplicateRows, (row) => {
      const valueStr = formatValues(compiler, row, pkColumnSymbols);
      return getDiagnosticAnchorValues(row, pkColumns).map((v) =>
        recordsPkDuplicate(compiler, resolveRecordValueNode(compiler, v), { table: tableSymbol, columns: pkColumnSymbols, valueStr }));
    }),
  );
}

// Check if any PK columns are missing from the record column list.
// Returns warnings if missing columns have no default or auto-increment.
function checkMissingPkColumns (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  recordBlock: SyntaxNode,
  pkColumnSymbols: ColumnSymbol[],
  record: TableRecord,
): CompileInfo[] {
  const pkColumns = pkColumnSymbols.map((c) => c.name ?? '');
  const availableColumns = new Set(record.columns);
  const missingColumns = difference(pkColumns, Array.from(availableColumns));
  if (isEmpty(missingColumns)) return [];

  const missingSet = new Set(missingColumns);
  const missingSymbols = pkColumnSymbols.filter((c) => missingSet.has(c.name ?? ''));
  const missingWithoutDefaultSymbols = missingSymbols
    .filter((col) => !col.increment(compiler) && !col.default(compiler));
  if (isEmpty(missingWithoutDefaultSymbols)) return [];

  return record.values.map(() =>
    recordsPkMissing(compiler, recordBlock, { table: tableSymbol, columns: missingWithoutDefaultSymbols }));
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
