import type {
  DiagramViewSyncOperation, DiagramViewBlock, TextEdit,
  DepSyncOperation, ElementIdentifier, TableIdentifier,
} from '@dbml/parse';

export function renameTable(
  oldName: string | TableIdentifier,
  newName: string | TableIdentifier,
  dbmlCode: string
): string;

export function updateElementSettingEdit(
  dbmlCode: string,
  target: ElementIdentifier,
  settingName: string,
  value: string | null | undefined,
): TextEdit[];

export function updateElementSetting(
  dbmlCode: string,
  target: ElementIdentifier,
  settingName: string,
  value: string | null | undefined,
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
): { newDbml: string; edits: TextEdit[] };
