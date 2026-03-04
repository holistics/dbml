export type TableNameInput = string | { schema?: string; table: string };

export type DiagramViewFilterConfig = {
  tables: Array<{ name: string; schemaName?: string }> | null;
  schemas: Array<{ name: string }> | null;
  tableGroups: Array<{ name: string }> | null;
  stickyNotes: Array<{ name: string }> | null;
};

// Alias for backward compatibility
export type FilterConfig = DiagramViewFilterConfig;

export function renameTable(
  oldName: TableNameInput,
  newName: TableNameInput,
  dbmlCode: string
): string;

export function createDiagramView(
  name: string,
  visibleEntities: DiagramViewFilterConfig | string[],
  dbmlCode: string
): string;

export function updateDiagramView(
  name: string,
  visibleEntities: DiagramViewFilterConfig | string[],
  dbmlCode: string
): string;

export function renameDiagramView(
  oldName: string,
  newName: string,
  dbmlCode: string
): string;

export function deleteDiagramView(
  name: string,
  dbmlCode: string
): string;

export type ViewItem = {
  name: string;
  visibleEntities: DiagramViewFilterConfig;
};

export function migrateViewsToDbml(
  dbViews: ViewItem[],
  dbmlCode: string
): string;

export interface DiagramViewOperation {
  type: 'create' | 'update' | 'rename';
  oldName?: string;
  newName: string;
  filterConfig?: DiagramViewFilterConfig;
}

export function syncDiagramViews(
  operations: DiagramViewOperation[],
  allDbViews: ViewItem[],
  dbmlCode: string
): string;
