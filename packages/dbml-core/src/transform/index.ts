import { Compiler } from '@dbml/parse';
import type { DiagramViewSyncOperation, DiagramViewBlock, TextEdit } from '@dbml/parse';

type TableName = string | { schema?: string; table: string };

export function renameTable (oldName: TableName, newName: TableName, dbmlCode: string): string {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.renameTable(oldName, newName);
}

export function syncDiagramView (
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): { newDbml: string; edits: TextEdit[] } {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.syncDiagramView(operations, blocks);
}

export function findDiagramViewBlocks (dbmlCode: string): DiagramViewBlock[] {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.findDiagramViewBlocks();
}
