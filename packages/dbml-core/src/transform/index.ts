import { Compiler, DEFAULT_ENTRY, MemoryProjectLayout } from '@dbml/parse';
import type {
  DiagramViewSyncOperation, DiagramViewBlock, TextEdit,
  DepSyncOperation, DepBlock, ElementIdentifier, TableIdentifier,
} from '@dbml/parse';

export { findDiagramViewBlocks, findDepBlocks } from '@dbml/parse';

export function renameTable (oldName: string | TableIdentifier, newName: string | TableIdentifier, dbmlCode: string): string {
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

export function updateElementSettingEdit (
  dbmlCode: string,
  target: ElementIdentifier,
  settingName: string,
  value: string | null | undefined,
): TextEdit[] {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler(layout);
  return compiler.updateElementSettingEdit(DEFAULT_ENTRY, target, settingName, value);
}

export function updateElementSetting (
  dbmlCode: string,
  target: ElementIdentifier,
  settingName: string,
  value: string | null | undefined,
): string {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbmlCode);
  const compiler = new Compiler(layout);
  return compiler.updateElementSetting(DEFAULT_ENTRY, target, settingName, value);
}
