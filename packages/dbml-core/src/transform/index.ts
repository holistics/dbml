import { Compiler, DEFAULT_ENTRY, MemoryProjectLayout } from '@dbml/parse';
import type {
  DiagramViewSyncOperation, DiagramViewBlock, TextEdit,
  DepSyncOperation, DepBlock,
} from '@dbml/parse';

type TableName = string | { schema?: string; table: string };

export function renameTable (oldName: TableName, newName: TableName, dbmlCode: string): string {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler(layout);
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
  const compiler = new Compiler(layout);
  return compiler.syncDiagramView(DEFAULT_ENTRY, operations, blocks);
}

export function findDiagramViewBlocks (dbmlCode: string): DiagramViewBlock[] {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler(layout);
  return compiler.findDiagramViewBlocks(DEFAULT_ENTRY);
}

export function syncDep (
  dbmlCode: string,
  operations: DepSyncOperation[],
  blocks?: DepBlock[],
): { newDbml: string; edits: TextEdit[] } {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler(layout);
  return compiler.syncDep(DEFAULT_ENTRY, operations, blocks);
}

export function findDepBlocks (dbmlCode: string): DepBlock[] {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler(layout);
  return compiler.findDepBlocks(DEFAULT_ENTRY);
}
