import type { DiagramViewSyncOperation, TextEdit } from '@dbml/parse';

export type TableNameInput = string | { schema?: string; table: string };

export function renameTable(
  oldName: TableNameInput,
  newName: TableNameInput,
  dbmlCode: string
): string;

export function syncDiagramView(
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
): { newDbml: string; edits: TextEdit[] };
