import type { DiagramViewSyncOperation, DiagramViewBlock, TextEdit } from '@dbml/parse';

export type TableNameInput = string | { schema?: string; table: string };

/**
 * Renames a table in a single-file DBML document.
 * The entire `dbmlCode` string is treated as the sole entry point.
 * For multifile projects use `@dbml/parse`'s `Compiler.renameTable` directly.
 */
export function renameTable(
  oldName: TableNameInput,
  newName: TableNameInput,
  dbmlCode: string
): string;

/**
 * Applies create/update/delete operations to DiagramView blocks in a
 * single-file DBML document.
 * The entire `dbmlCode` string is treated as the sole entry point.
 * For multifile projects use `@dbml/parse`'s `Compiler.syncDiagramView` directly.
 */
export function syncDiagramView(
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): { newDbml: string; edits: TextEdit[] };

/**
 * Returns the start/end positions of all DiagramView blocks in a DBML string.
 * Returns an empty array if the source cannot be lexed or parsed — callers
 * cannot distinguish "no blocks" from "malformed DBML" without inspecting
 * the source themselves.
 */
export function findDiagramViewBlocks(
  dbmlCode: string,
): DiagramViewBlock[];
