import {
  compact, filter, flatMap, groupBy, isEmpty, keyBy,
} from 'lodash-es';
import type Compiler from '@/compiler/index';
import type { CompileInfo } from '@/core/types/errors';
import type {
  Index,
  RecordValue,
  TableRecord,
} from '@/core/types/schemaJson';
import { TableSymbol, type ColumnSymbol } from '@/core/types/symbol';
import { recordsUniqueDuplicate } from '@/core/utils/diagnostics_reporter';
import {
  resolveRecordValueNode,
  extractKeyValueWithDefault,
  formatValues,
  getDiagnosticAnchorValues,
  hasNullWithoutDefaultInKey,
  toKeyedRows,
} from './helper';

// Validate unique constraints for a table's records
export function validateUnique (compiler: Compiler, tableSymbol: TableSymbol, record: TableRecord): CompileInfo[] {
  if (isEmpty(record.values)) return [];

  const rows = toKeyedRows(record);
  const uniqueConstraints = collectUniqueConstraints(compiler, tableSymbol);

  return flatMap(uniqueConstraints, (uniqueColumnSymbols) =>
    checkUniqueDuplicates(compiler, tableSymbol, uniqueColumnSymbols, rows),
  );
}

// Find all unique constraints in a table symbol:
// - Inline unique
// - Composite unique via indexes
function collectUniqueConstraints (compiler: Compiler, tableSymbol: TableSymbol): ColumnSymbol[][] {
  const columns = tableSymbol.mergedColumns(compiler);
  const columnSymbolMap = keyBy(columns, (column) => column.name ?? '');

  return [
    ...columns
      .filter((col) => col.isUniqueSet(compiler))
      .map((col) => [
        col,
      ]),
    ...tableSymbol.mergedIndexes(compiler).flatMap((index) => {
      const result = compiler.interpretMetadata(index, index.declaration.filepath).getValue();

      if (!Array.isArray(result)) return [];
      return (result as Index[])
        .filter((element) => element.unique)
        .map((element) => compact(
          element.columns.map(
            (column) => columnSymbolMap[column.value],
          ),
        ));
    }),
  ];
}

// Check if 1 unique constraint is violated, a unique constraint is a list of column symbols
function checkUniqueDuplicates (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  uniqueColumnSymbols: ColumnSymbol[],
  rows: Record<string, RecordValue>[],
): CompileInfo[] {
  const uniqueColumnNames = uniqueColumnSymbols.map((column) => column.name ?? '');

  // Filter out rows with NULL values (SQL standard: NULLs don't conflict in UNIQUE constraints)
  const rowsWithoutNull = rows.filter((row) =>
    !hasNullWithoutDefaultInKey(compiler, row, uniqueColumnSymbols),
  );

  // Group rows by their unique key value
  const rowsByKeyValue = groupBy(rowsWithoutNull, (row) =>
    extractKeyValueWithDefault(compiler, row, uniqueColumnSymbols),
  );

  // Find groups with more than 1 row (duplicates)
  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  return flatMap(duplicateGroups, (duplicateRows) =>
    flatMap(duplicateRows, (row) => {
      const valueString = formatValues(compiler, row, uniqueColumnSymbols);
      return getDiagnosticAnchorValues(row, uniqueColumnNames)
        .map((value) => recordsUniqueDuplicate(compiler, resolveRecordValueNode(compiler, value), { table: tableSymbol, columns: uniqueColumnSymbols, valueStr: valueString }));
    }),
  );
}
