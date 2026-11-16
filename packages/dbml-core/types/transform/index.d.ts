import type {
  DiagramViewSyncOperation, DiagramViewBlock, TextEdit,
  DepSyncOperation, ElementIdentifier, TableIdentifier, ArchElementIdentifier,
} from '@dbml/parse';

export function renameTable(
  oldName: string | TableIdentifier,
  newName: string | TableIdentifier,
  dbmlCode: string
): string;

export function renameElement(
  oldHandle: string,
  newName: string,
  dbmlCode: string,
  role?: string,
): string;

export function renameElementEdit(
  dbmlCode: string,
  oldHandle: string,
  newName: string,
  role?: string,
): TextEdit[];

export function groupElementsEdit(
  dbmlCode: string,
  members: ArchElementIdentifier[],
  parent: string | null,
  name: string,
): TextEdit[];

export function ungroupElementsEdit(
  dbmlCode: string,
  handle: string,
  members: ArchElementIdentifier[],
  parent: string | null,
): TextEdit[];

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
