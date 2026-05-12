import { Compiler, DEFAULT_ENTRY, MemoryProjectLayout } from '@dbml/parse';
import type { DiagramViewSyncOperation, DiagramViewBlock, TextEdit } from '@dbml/parse';

type TableName = string | { schema?: string; table: string };

export function renameTable (oldName: TableName, newName: TableName, dbmlCode: string): string {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler();
  compiler.layout = layout;
  const changes = compiler.renameTable(DEFAULT_ENTRY, oldName, newName);
  return changes.get(DEFAULT_ENTRY.absolute) ?? dbmlCode;
}

export function syncDiagramView (
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): { newDbml: string; edits: TextEdit[] } {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler();
  compiler.layout = layout;
  return compiler.syncDiagramView(DEFAULT_ENTRY, operations, blocks);
}

export function findDiagramViewBlocks (dbmlCode: string): DiagramViewBlock[] {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler();
  compiler.layout = layout;
  return compiler.findDiagramViewBlocks(DEFAULT_ENTRY);
}
