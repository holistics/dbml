import type { DiagramViewBlock, DiagramViewSyncOperation, TextEdit } from '@dbml/parse';

export type TableNameInput = string | { schema?: string; table: string };

export function renameTable(
  oldName: TableNameInput,
  newName: TableNameInput,
  dbmlCode: string,
): string;

export function findDiagramViewBlocks(dbmlCode: string): DiagramViewBlock[];

export function syncDiagramView(
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): { newDbml: string; edits: TextEdit[] };
