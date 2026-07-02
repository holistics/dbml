import type {
  DiagramViewSyncOperation, DiagramViewBlock, TextEdit,
  DepSyncOperation, DepBlock,
} from '@dbml/parse';

export type TableNameInput = string | { schema?: string; table: string };

export function renameTable(
  oldName: TableNameInput,
  newName: TableNameInput,
  dbmlCode: string
): string;

export function syncDiagramView(
  dbmlCode: string,
  operations: DiagramViewSyncOperation[],
  blocks?: DiagramViewBlock[],
): { newDbml: string; edits: TextEdit[] };

export function findDiagramViewBlocks(
  dbmlCode: string,
): DiagramViewBlock[];

export function syncDep(
  dbmlCode: string,
  operations: DepSyncOperation[],
  blocks?: DepBlock[],
): { newDbml: string; edits: TextEdit[] };

export function findDepBlocks(
  dbmlCode: string,
): DepBlock[];
