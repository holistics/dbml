import {
  Compiler, DEFAULT_ENTRY, syncDiagramView as _syncDiagramView,
} from '@dbml/parse';
import type { DiagramViewSyncOperation } from '@dbml/parse';

type TableName = string | { schema?: string; table: string };

export function renameTable (oldName: TableName, newName: TableName, dbmlCode: string): string {
  const compiler = new Compiler();
  compiler.setSource(DEFAULT_ENTRY, dbmlCode);
  return compiler.renameTable(DEFAULT_ENTRY, oldName, newName);
}

export function syncDiagramView (
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
): { newDbml: string } {
  return _syncDiagramView(dbmlCode, operations);
}
