import {
  Compiler, DEFAULT_ENTRY, findDiagramViewBlocks,
} from '@dbml/parse';
import type { DiagramViewBlock, DiagramViewSyncOperation, TextEdit } from '@dbml/parse';

type TableName = string | { schema?: string; table: string };

/**
 * Renames a table in a single-file DBML document. Assumes `dbmlCode` is the
 * entire project source; the compiler treats it as the default entry.
 *
 * @param oldName  Current table name (string or `{ schema?, table }`).
 * @param newName  Replacement table name.
 * @param dbmlCode The DBML source containing the table.
 * @returns The updated DBML source.
 */
export function renameTable (
  oldName: TableName,
  newName: TableName,
  dbmlCode: string,
): string {
  const compiler = new Compiler();
  compiler.setSource(DEFAULT_ENTRY, dbmlCode);
  const layout = compiler.renameTable(DEFAULT_ENTRY, oldName, newName);
  return layout.getSource(DEFAULT_ENTRY) ?? dbmlCode;
}

/**
 * Applies create/update/delete operations to DiagramView blocks in a
 * single-file DBML document.
 */
export { findDiagramViewBlocks };

export function syncDiagramView (
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): { newDbml: string; edits: TextEdit[] } {
  const compiler = new Compiler();
  compiler.setSource(DEFAULT_ENTRY, dbmlCode);
  return compiler.syncDiagramView(DEFAULT_ENTRY, operations, blocks);
}
