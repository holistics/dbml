import {
  compact, filter, flatMap, groupBy, isEmpty, keyBy,
} from 'lodash-es';
import type Compiler from '@/compiler/index';
import type {
  CompileWarning,
} from '@/core/types/errors';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  RecordValue,
} from '@/core/types/schemaJson';
import type {
  TableRecord,
} from '@/core/types/schemaJson';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  TableSymbol,
} from '@/core/types/symbol';
import {
  type ColumnInfo,
  columnInfoFromSymbol,
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
export function validateUnique (compiler: Compiler, tableNode: SyntaxNode, record: TableRecord): CompileWarning[] {
  if (isEmpty(record.values)) return [];

  const tableSymbol = compiler.nodeSymbol(tableNode).getFiltered(UNHANDLED);
  if (!(tableSymbol instanceof TableSymbol)) return [];

  const columns = tableSymbol.mergedColumns(compiler);
  const columnInfos = columns.map((c) => columnInfoFromSymbol(c, compiler));
  const columnMap = keyBy(columnInfos, 'name');

  const rows = toKeyedRows(record);
  const schemaName = tableSymbol.schemaName(compiler);
  const tableName = tableSymbol.name ?? '';
  const uniqueConstraints = collectUniqueConstraints(tableSymbol, columnInfos, compiler);

  return flatMap(uniqueConstraints, (uniqueColumns) => {
    const uniqueColumnFields = compact(uniqueColumns.map((col) => columnMap[col]));
    return checkUniqueDuplicates(compiler, rows, uniqueColumns, uniqueColumnFields, schemaName, tableName);
  });
}

function collectUniqueConstraints (tableSymbol: TableSymbol, columnInfos: ColumnInfo[], compiler: Compiler): string[][] {
  return [
    ...columnInfos.filter((col) => col.unique).map((col) => [
      col.name,
    ]),
    ...tableSymbol.mergedIndexes(compiler).filter((index) => index.unique).map((index) => index.columns.map((c) => c.value)),
  ];
}

function checkUniqueDuplicates (
  compiler: Compiler,
  rows: Record<string, RecordValue>[],
  uniqueColumns: string[],
  uniqueColumnFields: (ColumnInfo | undefined)[],
  schemaName: string | null,
  tableName: string,
): CompileWarning[] {
  // Filter out rows with NULL values (SQL standard: NULLs don't conflict in UNIQUE constraints)
  const rowsWithoutNull = rows.filter((row) =>
    !hasNullWithoutDefaultInKey(row, uniqueColumns, uniqueColumnFields),
  );

  // Group rows by their unique key value
  const rowsByKeyValue = groupBy(rowsWithoutNull, (row) =>
    extractKeyValueWithDefault(row, uniqueColumns, uniqueColumnFields),
  );

  // Find groups with more than 1 row (duplicates)
  const duplicateGroups = filter(rowsByKeyValue, (group) => group.length > 1);

  // Transform duplicate groups to warnings
  return flatMap(duplicateGroups, (duplicateRows) => {
    const constraintType = getConstraintType(uniqueColumns.length);
    const columnRef = formatFullColumnNames(schemaName, tableName, uniqueColumns);

    return flatMap(duplicateRows, (row) => {
      const valueStr = formatValues(row, uniqueColumns);
      const message = `Duplicate ${constraintType}: ${columnRef} = ${valueStr}`;
      return uniqueColumns.map((col) => createConstraintWarning(compiler, row[col], message));
    });
  });
}
