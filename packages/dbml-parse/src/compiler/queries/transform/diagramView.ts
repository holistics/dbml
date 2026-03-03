import { applyTextEdits } from './applyTextEdits';

/**
 * FilterConfig type for DiagramView visible entities
 */
export interface DiagramViewFilterConfig {
  tables: Array<{ name: string; schemaName?: string }> | null;
  schemas: Array<{ name: string }> | null;
  tableGroups: Array<{ name: string }> | null;
  stickyNotes: Array<{ name: string }> | null;
}

/**
 * Generates DBML text for a DiagramView block with full FilterConfig.
 */

/**
 * Quotes a name if it contains spaces or special characters
 */
function quoteNameIfNeeded(name: string): string {
  if (/[\s\-]/.test(name)) {
    return `"${name}"`;
  }
  return name;
}

function generateDiagramViewDbml(name: string, filterConfig: DiagramViewFilterConfig): string {
  const quotedName = quoteNameIfNeeded(name);
  const lines: string[] = [`DiagramView ${quotedName} {`];

  // tables
  if (filterConfig && filterConfig.tables !== null && filterConfig.tables !== undefined) {
    if (filterConfig.tables.length > 0) {
      lines.push('  tables {');
      filterConfig.tables.forEach(t => {
        const tableRef = t.schemaName ? `${t.schemaName}.${t.name}` : t.name;
        lines.push(`    ${tableRef}`);
      });
      lines.push('  }');
    } else {
      lines.push('  tables {}');
    }
  }

  // notes (stickyNotes)
  if (filterConfig && filterConfig.stickyNotes !== null && filterConfig.stickyNotes !== undefined) {
    if (filterConfig.stickyNotes.length > 0) {
      lines.push('  notes {');
      filterConfig.stickyNotes.forEach(n => {
        lines.push(`    ${n.name}`);
      });
      lines.push('  }');
    } else {
      lines.push('  notes {}');
    }
  }

  // tableGroups
  if (filterConfig && filterConfig.tableGroups !== null && filterConfig.tableGroups !== undefined) {
    if (filterConfig.tableGroups.length > 0) {
      lines.push('  tableGroups {');
      filterConfig.tableGroups.forEach(g => {
        lines.push(`    ${g.name}`);
      });
      lines.push('  }');
    } else {
      lines.push('  tableGroups {}');
    }
  }

  // schemas
  if (filterConfig && filterConfig.schemas !== null && filterConfig.schemas !== undefined) {
    if (filterConfig.schemas.length > 0) {
      lines.push('  schemas {');
      filterConfig.schemas.forEach(s => {
        lines.push(`    ${s.name}`);
      });
      lines.push('  }');
    } else {
      lines.push('  schemas {}');
    }
  }

  lines.push('}');
  return lines.join('\n');
}

/**
 * Finds DiagramView block by name and returns its token range.
 */
function findDiagramViewToken(source: string, name: string): { start: number; end: number } | null {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match both quoted and unquoted names
  const regex = new RegExp(`DiagramView\\s+(?:"${escapedName}"|${escapedName})\\s*\\{`);
  const match = regex.exec(source);
  if (!match) return null;

  const start = match.index;
  let braceCount = 0;
  let end = start + match[0].length - 1;

  for (let i = start + match[0].length - 1; i < source.length; i++) {
    if (source[i] === '{') braceCount++;
    else if (source[i] === '}') {
      braceCount--;
      if (braceCount === 0) {
        end = i + 1;
        break;
      }
    }
  }

  return { start, end };
}

/**
 * Helper to convert string[] to FilterConfig for backward compatibility
 */
function convertToFilterConfig(tablesOrConfig: string[] | DiagramViewFilterConfig): DiagramViewFilterConfig {
  if (Array.isArray(tablesOrConfig)) {
    // Old API: string[] - convert to FilterConfig
    return {
      tables: tablesOrConfig.map(t => ({ name: t, schemaName: '' })),
      schemas: null,
      tableGroups: null,
      stickyNotes: null,
    };
  }
  // New API: FilterConfig
  return tablesOrConfig;
}

/**
 * Creates a new DiagramView block in the DBML code.
 */
export function createDiagramView(
  this: any,
  name: string,
  visibleEntities: DiagramViewFilterConfig | string[],
  dbmlCode: string
): string {
  const filterConfig = convertToFilterConfig(visibleEntities);
  const newBlock = generateDiagramViewDbml(name, filterConfig);
  if (!dbmlCode) return newBlock;

  // Ensure the result ends with the new block when trimmed
  const trimmedDbml = dbmlCode.trimEnd();
  return `${trimmedDbml}\n\n${newBlock}\n`;
}

/**
 * Updates an existing DiagramView block in the DBML code.
 */
export function updateDiagramView(
  this: any,
  name: string,
  visibleEntities: DiagramViewFilterConfig | string[],
  dbmlCode: string
): string {
  const filterConfig = convertToFilterConfig(visibleEntities);
  const existing = findDiagramViewToken(dbmlCode, name);
  const newBlock = generateDiagramViewDbml(name, filterConfig);

  if (!existing) {
    // If doesn't exist, create it
    return dbmlCode ? `${dbmlCode}\n\n${newBlock}` : newBlock;
  }

  // Replace existing block
  const edits = [{ start: existing.start, end: existing.end, newText: newBlock }];
  return applyTextEdits(dbmlCode, edits);
}

/**
 * Renames an existing DiagramView block.
 */
export function renameDiagramView(this: any, oldName: string, newName: string, dbmlCode: string): string {
  const existing = findDiagramViewToken(dbmlCode, oldName);
  if (!existing) return dbmlCode;

  // Quote names if needed (for names with spaces)
  const quotedOldName = quoteNameIfNeeded(oldName);
  const quotedNewName = quoteNameIfNeeded(newName);

  // Replace the DiagramView name
  const oldHeader = `DiagramView ${quotedOldName}`;
  const newHeader = `DiagramView ${quotedNewName}`;
  const edits = [
    { start: existing.start, end: existing.start + oldHeader.length, newText: newHeader }
  ];
  return applyTextEdits(dbmlCode, edits);
}

/**
 * Deletes an existing DiagramView block.
 */
export function deleteDiagramView(this: any, name: string, dbmlCode: string): string {
  const existing = findDiagramViewToken(dbmlCode, name);
  if (!existing) return dbmlCode;

  // Delete the block
  const edits = [{ start: existing.start, end: existing.end, newText: '' }];
  return applyTextEdits(dbmlCode, edits);
}

/**
 * Migration interface for database views.
 */
interface DbView {
  name: string;
  tables: string[];
}

/**
 * Creates DiagramView blocks for multiple database views.
 */
export function migrateViewsToDbml(this: any, dbViews: DbView[], dbmlCode: string): string {
  let result = dbmlCode;

  for (const view of dbViews) {
    if (view.tables) {
      result = createDiagramView.call(this, view.name, view.tables, result);
    }
  }

  return result;
}

/**
 * Operation types for syncDiagramViews
 */
export interface DiagramViewOperation {
  type: 'create' | 'update' | 'rename';
  oldName?: string;
  newName: string;
  filterConfig?: DiagramViewFilterConfig;
}

/**
 * View item for syncDiagramViews
 */
export interface ViewItem {
  name: string;
  visibleEntities: DiagramViewFilterConfig;
}

/**
 * Unified function that handles:
 * 1. User's operation (create/update/rename)
 * 2. Auto-migration of DB views that don't have DBML blocks yet
 */
export function syncDiagramViews(
  this: any,
  operation: DiagramViewOperation,
  allDbViews: ViewItem[],
  dbmlCode: string
): string {
  let result = dbmlCode;

  // Get existing DiagramView names from DBML
  const existingNames = new Set<string>();
  // Match both quoted "name" and unquoted name
  const regex = /DiagramView\s+(?:"([^"]+)"|(\w+))/g;
  let match;
  while ((match = regex.exec(dbmlCode)) !== null) {
    // match[1] is quoted name, match[2] is unquoted name
    const name = match[1] || match[2];
    existingNames.add(name);
  }

  // Step 1: Apply user's operation
  switch (operation.type) {
    case 'create':
      if (operation.filterConfig) {
        result = createDiagramView(operation.newName, operation.filterConfig, result);
      }
      break;
    case 'update':
      if (operation.filterConfig) {
        result = updateDiagramView(operation.newName, operation.filterConfig, result);
      }
      break;
    case 'rename':
      result = renameDiagramView(operation.oldName!, operation.newName, result);
      break;
  }

  // Step 2: Auto-migrate DB views that don't have DBML blocks
  for (const dbView of allDbViews) {
    if (!existingNames.has(dbView.name)) {
      // This DB view doesn't have a DBML block, create it
      const filterConfig = dbView.visibleEntities || {
        tables: null,
        schemas: null,
        tableGroups: null,
        stickyNotes: null,
      };
      result = createDiagramView(dbView.name, filterConfig, result);
    }
  }

  return result;
}
