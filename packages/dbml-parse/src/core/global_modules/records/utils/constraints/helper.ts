import {
  CompileErrorCode, CompileWarning,
} from '@/core/types/errors';
import type {
  SyntaxNode,
} from '@/core/types/nodes';
import type {
  Column, RecordValue, TableRecord,
} from '@/core/types/schemaJson';
import {
  isSerialType,
} from '../data';

export function buildColumnIndex (record: TableRecord): Map<string, number> {
  const index = new Map<string, number>();
  for (let i = 0; i < record.columns.length; i++) {
    index.set(record.columns[i], i);
  }
  return index;
}

export function extractKeyValueWithDefault (
  row: RecordValue[],
  columnNames: string[],
  columnIndex: Map<string, number>,
  columns?: (Column | undefined)[],
): string {
  return columnNames.map((name, idx) => {
    const colIdx = columnIndex.get(name);
    const value = colIdx !== undefined ? row[colIdx]?.value : undefined;

    if ((value === null || value === undefined) && columns && columns[idx]) {
      const column = columns[idx];
      if (column?.dbdefault) {
        return JSON.stringify(column.dbdefault.value);
      }
    }

    return JSON.stringify(value);
  }).join('|');
}

export function hasNullWithoutDefaultInKey (
  row: RecordValue[],
  columnNames: string[],
  columnIndex: Map<string, number>,
  columns?: (Column | undefined)[],
): boolean {
  return columnNames.some((name, idx) => {
    const colIdx = columnIndex.get(name);
    const value = colIdx !== undefined ? row[colIdx]?.value : undefined;

    if ((value === null || value === undefined) && columns && columns[idx]) {
      const column = columns[idx];
      if (column?.dbdefault) {
        return false;
      }
    }

    return value === null || value === undefined;
  });
}

export function isAutoIncrementColumn (column: Column): boolean {
  return column.increment || isSerialType(column.type.type_name);
}

export function hasNotNullWithDefault (column: Column): boolean {
  return (column.not_null || false) && !!column.dbdefault;
}

export function formatFullColumnName (
  schemaName: string | null | undefined,
  tableName: string,
  columnName: string,
): string {
  if (schemaName) {
    return `${schemaName}.${tableName}.${columnName}`;
  }
  return `${tableName}.${columnName}`;
}

export function formatFullColumnNames (
  schemaName: string | null | undefined,
  tableName: string,
  columnNames: string[],
): string {
  if (columnNames.length === 1) {
    return formatFullColumnName(schemaName, tableName, columnNames[0]);
  }
  const formatted = columnNames.map((col) => formatFullColumnName(schemaName, tableName, col));
  return `(${formatted.join(', ')})`;
}

// Format values to put in error messages
// e.g. 1 -> '1'
// e.g. 'a' -> '"a"'
// e.g. 1, 'a' -> '(1, "a")'
export function formatValues (
  row: RecordValue[],
  columnNames: string[],
  columnIndex: Map<string, number>,
): string {
  if (columnNames.length === 1) {
    const colIdx = columnIndex.get(columnNames[0]);
    return JSON.stringify(colIdx !== undefined ? row[colIdx]?.value : null);
  }
  const values = columnNames.map((col) => {
    const colIdx = columnIndex.get(col);
    return JSON.stringify(colIdx !== undefined ? row[colIdx]?.value : null);
  }).join(', ');
  return `(${values})`;
}

export {
  createConstraintWarnings as createConstraintErrors,
};

// Source-range nodes collected at records-interpret time. Threaded through
// constraint validators so violation warnings can anchor to the offending
// row's cell (or row, or records-block) instead of passing a schemaJson
// TableRecord — the latter has no startPos/endPos and crashes diagnostics.
export interface RecordNodes {
  block: SyntaxNode;
  rows: SyntaxNode[];
  cells: Array<Record<string, SyntaxNode>>;
}

export function pickCell (nodes: RecordNodes, rowIdx: number, colName?: string): SyntaxNode {
  if (colName !== undefined) {
    const cell = nodes.cells[rowIdx]?.[colName];
    if (cell) return cell;
  }
  return nodes.rows[rowIdx] ?? nodes.block;
}

/**
 * Create constraint warnings anchored on a syntax node so diagnostics have a
 * valid startPos/endPos.
 */
export function createConstraintWarnings (
  node: SyntaxNode,
  message: string,
): CompileWarning[] {
  return [
    new CompileWarning(
      CompileErrorCode.INVALID_RECORDS_FIELD,
      message,
      node,
    ),
  ];
}
