import {
  compact, filter, flatMap, groupBy, isEmpty, keyBy,
} from 'lodash-es';
import type Compiler from '@/compiler/index';
import type { CompileWarning } from '@/core/types/errors';
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
  hasNullWithoutDefaultInKey,
  toKeyedRows,
} from './helper';

const getConstraintType = (columnCount: number) =>
  columnCount > 1 ? 'Composite UNIQUE' : 'UNIQUE';

// Validate unique constraints for a table's records.
export function validateUnique (compiler: Compiler, tableSymbol: TableSymbol, record: TableRecord): CompileWarning[] {
  if (isEmpty(record.values)) return [];

  const rows = toKeyedRows(record);
  const uniqueConstraints = collectUniqueConstraints(compiler, tableSymbol);

  return flatMap(uniqueConstraints, (uniqueColumnSymbols) =>
    checkUniqueDuplicates(compiler, tableSymbol, uniqueColumnSymbols, rows),
  );
}

function collectUniqueConstraints (compiler: Compiler, tableSymbol: TableSymbol): ColumnSymbol[][] {
  const columns = tableSymbol.mergedColumns(compiler);
  const columnSymbolMap = keyBy(columns, (c) => c.name ?? '');

  return [
    ...columns.filter((col) => col.unique(compiler)).map((col) => [
      col,
    ]),
    ...tableSymbol.mergedIndexes(compiler).flatMap((index) => {
      const result = compiler.interpretMetadata(index, index.declaration.filepath).getValue();
      if (!Array.isArray(result)) return [];
      return (result as Index[]).filter((e) => e.unique).map((e) => compact(e.columns.map((c) => columnSymbolMap[c.value])));
    }),
  ];
}

function checkUniqueDuplicates (
  compiler: Compiler,
  tableSymbol: TableSymbol,
  uniqueColumnSymbols: ColumnSymbol[],
  rows: Record<string, RecordValue>[],
): CompileWarning[] {
  const uniqueColumns = uniqueColumnSymbols.map((c) => c.name ?? '');
  const schemaName = tableSymbol.schema(compiler);
  const tableName = tableSymbol.name ?? '';

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

  // Transform duplicate groups to warnings
  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(uniqueColumns.length);
    const columnRef = formatFullColumnNames(schemaName, tableName, uniqueColumns);

    return flatMap(duplicateRows, (row) => {
      const valueStr = formatValues(compiler, row, uniqueColumnSymbols);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return uniqueColumns.map((col) => createConstraintWarning(compiler, row[col], message));
    });
  });
}
