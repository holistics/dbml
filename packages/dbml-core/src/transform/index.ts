import { Compiler, DEFAULT_ENTRY } from '@dbml/parse';
import type { DiagramViewSyncOperation, DiagramViewBlock, TextEdit } from '@dbml/parse';
export { findDiagramViewBlocks } from '@dbml/parse';

type TableName = string | { schema?: string; table: string };

export function renameTable (oldName: TableName, newName: TableName, dbmlCode: string): string {
  const compiler = new Compiler();
  compiler.setSource(DEFAULT_ENTRY, dbmlCode);
  return compiler.renameTable(DEFAULT_ENTRY, oldName, newName);
}

export function syncDiagramView (
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): { newDbml: string; edits: TextEdit[] } {
  const compiler = new Compiler();
  compiler.setSource(DEFAULT_ENTRY, dbmlCode);
  return compiler.syncDiagramView(DEFAULT_ENTRY, operations, blocks);
}
