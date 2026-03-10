import { applyTextEdits } from './applyTextEdits';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

/**
 * FilterConfig type for DiagramView visible entities
 */
export interface DiagramViewFilterConfig {
  tables: Array<{ name: string; schemaName?: string | null }> | null;
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

  // Special case: all categories null → top-level *
  const allNull = filterConfig.tables === null
    && filterConfig.schemas === null
    && filterConfig.tableGroups === null
    && filterConfig.stickyNotes === null;

  if (allNull) {
    return `DiagramView ${quotedName} {\n  *\n}`;
  }

  const lines: string[] = [`DiagramView ${quotedName} {`];

  // tables
  if (filterConfig.tables === null) {
    lines.push('  Tables: {*}');
  } else if (filterConfig.tables.length > 0) {
    lines.push('  Tables {');
    for (const t of filterConfig.tables) {
      const ref = t.schemaName ? `${t.schemaName}.${t.name}` : t.name;
      lines.push(`    ${ref}`);
    }
    lines.push('  }');
  } else {
    lines.push('  Tables {}');
  }

  // notes (stickyNotes)
  if (filterConfig.stickyNotes === null) {
    lines.push('  Notes: {*}');
  } else if (filterConfig.stickyNotes.length > 0) {
    lines.push('  Notes {');
    for (const n of filterConfig.stickyNotes) {
      lines.push(`    ${n.name}`);
    }
    lines.push('  }');
  } else {
    lines.push('  Notes {}');
  }

  // tableGroups
  if (filterConfig.tableGroups === null) {
    lines.push('  TableGroups: {*}');
  } else if (filterConfig.tableGroups.length > 0) {
    lines.push('  TableGroups {');
    for (const g of filterConfig.tableGroups) {
      lines.push(`    ${g.name}`);
    }
    lines.push('  }');
  } else {
    lines.push('  TableGroups {}');
  }

  // schemas
  if (filterConfig.schemas === null) {
    lines.push('  Schemas: {*}');
  } else if (filterConfig.schemas.length > 0) {
    lines.push('  Schemas {');
    for (const s of filterConfig.schemas) {
      lines.push(`    ${s.name}`);
    }
    lines.push('  }');
  } else {
    lines.push('  Schemas {}');
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
 * Extracts all DiagramView names from existing DBML code
 */
function getExistingDbmlViewNames(dbmlCode: string): string[] {
  const names: string[] = [];
  const regex = /DiagramView\s+(?:"([^"]+)"|([^\s{]+))\s*\{/g;
  let match;
  while ((match = regex.exec(dbmlCode)) !== null) {
    names.push(match[1] || match[2]);
  }
  return names;
}

/**
 * Helper to convert string[] to FilterConfig for backward compatibility
 */
function convertToFilterConfig(tablesOrConfig: string[] | DiagramViewFilterConfig): DiagramViewFilterConfig {
  if (Array.isArray(tablesOrConfig)) {
    // Old API: string[] - convert to FilterConfig
    return {
      tables: tablesOrConfig.map(t => ({ name: t, schemaName: DEFAULT_SCHEMA_NAME })),
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
  type: 'create' | 'update' | 'rename' | 'delete';
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
 * Unified function that handles multiple operations atomically.
 * Also auto-creates views that exist in database but not in DBML.
 */
export function syncDiagramViews(
  this: any,
  operations: DiagramViewOperation[],
  allDbViews: ViewItem[],
  dbmlCode: string
): string {
  let result = dbmlCode;

  // Step 1: Apply all operations in a single pass
  const edits: Array<{ start: number; end: number; newText: string }> = [];

  for (const operation of operations) {
    switch (operation.type) {
      case 'create': {
        if (operation.filterConfig) {
          const newBlock = generateDiagramViewDbml(operation.newName, operation.filterConfig);
          result = result ? `${result.trimEnd()}\n\n${newBlock}\n` : `${newBlock}\n`;
        }
        break;
      }
      case 'update': {
        if (operation.filterConfig) {
          const existing = findDiagramViewToken(result, operation.newName);
          const newBlock = generateDiagramViewDbml(operation.newName, operation.filterConfig);
          if (existing) {
            edits.push({ start: existing.start, end: existing.end, newText: newBlock });
          } else {
            // If doesn't exist, create it
            result = result ? `${result.trimEnd()}\n\n${newBlock}\n` : `${newBlock}\n`;
          }
        }
        break;
      }
      case 'rename': {
        const existing = findDiagramViewToken(result, operation.oldName!);
        if (existing) {
          const quotedOldName = quoteNameIfNeeded(operation.oldName!);
          const quotedNewName = quoteNameIfNeeded(operation.newName);
          const oldHeader = `DiagramView ${quotedOldName}`;
          const newHeader = `DiagramView ${quotedNewName}`;
          edits.push({
            start: existing.start,
            end: existing.start + oldHeader.length,
            newText: newHeader
          });
        }
        break;
      }
      case 'delete': {
        const existing = findDiagramViewToken(result, operation.newName);
        if (existing) {
          edits.push({ start: existing.start, end: existing.end, newText: '' });
        }
        break;
      }
    }
  }

  // Apply all edits at once if there are any
  if (edits.length > 0) {
    result = applyTextEdits(result, edits);
  }

  // Step 2: Detect and auto-create missing views
  if (allDbViews && allDbViews.length > 0) {
    const existingViewNames = getExistingDbmlViewNames(result);

    for (const dbView of allDbViews) {
      if (!existingViewNames.includes(dbView.name)) {
        // Missing view - auto-create it
        const newBlock = generateDiagramViewDbml(dbView.name, dbView.visibleEntities);
        result = result ? `${result.trimEnd()}\n\n${newBlock}\n` : `${newBlock}\n`;
      }
    }
  }

  return result;
}
