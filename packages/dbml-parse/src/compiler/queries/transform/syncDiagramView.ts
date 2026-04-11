import { isAlphaOrUnderscore, isDigit } from '@/core/utils/chars';
import type { FilterConfig } from '@/core/types/schemaJson';
import { applyTextEdits, TextEdit } from './applyTextEdits';

export interface DiagramViewCreateOperation {
  operation: 'create';
  name: string;
  visibleEntities: FilterConfig;
}

export interface DiagramViewUpdateOperation {
  operation: 'update';
  name: string;
  newName: string;
}

export interface DiagramViewDeleteOperation {
  operation: 'delete';
  name: string;
}

export type DiagramViewSyncOperation = DiagramViewCreateOperation | DiagramViewUpdateOperation | DiagramViewDeleteOperation;

/** Returns true when a name can be used unquoted in DBML. */
function isSimpleIdentifier (name: string): boolean {
  if (!name) return false;
  return (
    (isAlphaOrUnderscore(name[0]) || name[0] === '_') &&
    name.split('').every((c) => isAlphaOrUnderscore(c) || isDigit(c))
  );
}

/** Wraps a name in double-quotes, escaping internal double-quotes. */
function quoteName (name: string): string {
  return `"${name.replace(/"/g, '\\"')}"`;
}

/** Formats a name for DBML output – quoted only when necessary. */
function formatName (name: string): string {
  return isSimpleIdentifier(name) ? name : quoteName(name);
}

/**
 * Normalises a raw DBML token value (which may be double-quoted) to a plain
 * string so it can be compared with operation names.
 */
function stripQuotes (raw: string): string {
  if (raw.startsWith('"') && raw.endsWith('"')) {
    return raw.slice(1, -1).replace(/\\"/g, '"');
  }
  return raw;
}

/**
 * Finds the start/end offset (in `source`) of a `DiagramView <name> { … }` block
 * whose name resolves to `targetName`.  Returns null when not found.
 */
function findDiagramViewBlock (
  source: string,
  targetName: string,
): { nameStart: number; nameEnd: number; blockStart: number; blockEnd: number } | null {
  const pattern = /DiagramView\s+("(?:[^"\\]|\\.)*"|[A-Za-z_][A-Za-z0-9_]*)\s*\{/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(source)) !== null) {
    const rawName = match[1];
    if (stripQuotes(rawName) !== targetName) continue;

    const nameStart = match.index + match[0].indexOf(match[1]);
    const nameEnd = nameStart + rawName.length;
    const openBrace = match.index + match[0].length - 1; // index of '{'

    // Find matching closing brace
    let depth = 1;
    let i = openBrace + 1;
    while (i < source.length && depth > 0) {
      if (source[i] === '{') depth++;
      else if (source[i] === '}') depth--;
      i++;
    }

    if (depth !== 0) continue; // malformed – skip

    return {
      nameStart,
      nameEnd,
      blockStart: match.index,
      blockEnd: i,
    };
  }

  return null;
}

/**
 * Serialises a FilterConfig into the body lines of a DiagramView block.
 * Each sub-block is only emitted when its value is non-null.
 */
function serializeVisibleEntities (ve: FilterConfig): string {
  const lines: string[] = [];

  function renderBlock (keyword: string, items: Array<{ name: string; schemaName?: string }> | null) {
    if (items === null) return;
    if (items.length === 0) {
      lines.push(`  ${keyword} { * }`);
    } else {
      const entries = items.map((i) => `    ${formatName(i.name)}`).join('\n');
      lines.push(`  ${keyword} {\n${entries}\n  }`);
    }
  }

  renderBlock('Tables', ve.tables as Array<{ name: string; schemaName?: string }> | null);
  renderBlock('Notes', ve.stickyNotes);
  renderBlock('TableGroups', ve.tableGroups);
  renderBlock('Schemas', ve.schemas);

  return lines.join('\n');
}

/**
 * Builds a complete `DiagramView <name> { … }` block string.
 */
function buildBlock (name: string, ve: FilterConfig): string {
  const body = serializeVisibleEntities(ve);
  const formattedName = formatName(name);
  if (!body) {
    return `DiagramView ${formattedName} {\n}`;
  }
  return `DiagramView ${formattedName} {\n${body}\n}`;
}

/**
 * Applies a sequence of create / update / delete operations to a DBML string
 * and returns the updated string.
 *
 * - **create** is idempotent: if a block with the same name already exists it
 *   is replaced in-place; otherwise the new block is appended.
 * - **update** renames the name token of an existing block (no-op when not found).
 * - **delete** removes the entire block (no-op when not found).
 */
export function syncDiagramView (
  source: string,
  operations: DiagramViewSyncOperation[],
): { newDbml: string } {
  let result = source;

  for (const op of operations) {
    switch (op.operation) {
      case 'create': {
        const existing = findDiagramViewBlock(result, op.name);
        if (existing) {
          // Replace existing block body
          const newBlock = buildBlock(op.name, op.visibleEntities);
          const edits: TextEdit[] = [{ start: existing.blockStart, end: existing.blockEnd, newText: newBlock }];
          result = applyTextEdits(result, edits);
        } else {
          // Append new block
          const newBlock = buildBlock(op.name, op.visibleEntities);
          const separator = result.length > 0 && !result.endsWith('\n') ? '\n' : '';
          result = result + separator + newBlock;
        }
        break;
      }

      case 'update': {
        const existing = findDiagramViewBlock(result, op.name);
        if (!existing) break;
        const newFormattedName = formatName(op.newName);
        const edits: TextEdit[] = [{ start: existing.nameStart, end: existing.nameEnd, newText: newFormattedName }];
        result = applyTextEdits(result, edits);
        break;
      }

      case 'delete': {
        const existing = findDiagramViewBlock(result, op.name);
        if (!existing) break;
        // Remove the whole block and any leading newline
        let deleteStart = existing.blockStart;
        if (deleteStart > 0 && result[deleteStart - 1] === '\n') {
          deleteStart--;
        }
        const edits: TextEdit[] = [{ start: deleteStart, end: existing.blockEnd, newText: '' }];
        result = applyTextEdits(result, edits);
        break;
      }
    }
  }

  return { newDbml: result };
}
