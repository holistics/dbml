/**
 * Dep block transform - read and write `Dep` blocks in DBML source.
 *
 * Parallel to {@link ./syncDiagramView.ts}, but a Dep block has no name to key on,
 * so a write is aimed at an edge and {@link findDepDefinition} finds the block or the
 * inline `[dep: …]` setting carrying it. The color picker uses this to write a dep's
 * `[color]`:
 *   - `update` an existing block's `[color]`, or
 *   - `create` a direct `Dep { a -> b } [color: <hex>]` when the picked
 *     (table-level) line has no direct block, or
 *   - `remove` an existing block's `[color]` so the dep falls back to its
 *     upstream -> group -> grey default.
 * `create` treats an already-matching block as an `update`, so it never
 * produces a duplicate `Dep`. `remove` on an edge with no block is a no-op.
 */

import type { Filepath } from '@/core/types/filepath';
import { SettingName } from '@/core/types/keywords';
import { ElementDeclarationNode } from '@/core/types/nodes';
import type Compiler from '../../index';
import { formatEndpoint, findDepDefinition } from './utils';
import type { DepDefinition } from './utils';
import { TextEdit, applyTextEdits } from './applyTextEdits';
import { updateNoteEdit, removeNoteEdit, addNoteEdit } from '@/core/utils/note';
import { updateSettingEdit } from '@/core/utils/setting';

// Types

export interface DepEndpointRef {
  schemaName?: string | null;
  tableName: string;
  fieldNames?: string[];
}

export interface DepSyncEdge {
  upstream: DepEndpointRef;
  downstream: DepEndpointRef;
}

export interface DepSyncOperation {
  operation: 'create' | 'update' | 'remove';
  /** The edge that identifies the target block (table-level: empty fields). */
  edge: DepSyncEdge;
  /** Set to a value to create/update, null to remove, undefined to leave unchanged. */
  color?: string | null;
  /** Set to a value to create/update, null to remove, undefined to leave unchanged. */
  note?: string | null;
}

/**
 * Synchronizes `Dep` blocks in the DBML source at `filepath`.
 * Applies create/update/remove operations and returns the rewritten source.
 */
export function syncDep (
  this: Compiler,
  filepath: Filepath,
  operations: DepSyncOperation[],
): {
  newDbml: string;
  edits: TextEdit[];
} {
  const dbml = this.getSource(filepath) ?? '';
  const allEdits: TextEdit[] = [];

  for (const op of operations) {
    allEdits.push(...applyOperation(this, filepath, dbml, op));
  }

  allEdits.sort((a, b) => b.start - a.start);
  const newDbml = applyTextEdits(dbml, allEdits, true);
  return { newDbml, edits: allEdits };
}

/** Emit a `Dep` block string for one edge with a `[color]` setting. */
export function generateDepBlock (edge: DepSyncEdge, color: string): string {
  const up = formatEndpoint(edge.upstream);
  const down = formatEndpoint(edge.downstream);
  return `Dep [color: ${color}] {\n  ${up} -> ${down}\n}`;
}

/** Dispatch a single sync operation to the appropriate edit strategy. */
function applyOperation (compiler: Compiler, filepath: Filepath, dbml: string, operation: DepSyncOperation): TextEdit[] {
  const definition = findDepDefinition(compiler, filepath, operation.edge);

  switch (operation.operation) {
    case 'create':
      return computeCreateEdit(dbml, operation, definition);
    case 'update':
      return definition?.kind === 'block' ? computeUpdateEdit(operation, definition.declaration, dbml) : [];
    case 'remove':
      return definition?.kind === 'block'
        ? computeUpdateEdit({ ...operation, color: undefined, note: undefined }, definition.declaration, dbml)
        : [];
    default:
      return [];
  }
}

/** Compute edits to update an existing block's color and/or note. */
function computeUpdateEdit (operation: DepSyncOperation, declaration: ElementDeclarationNode, source: string): TextEdit[] {
  const edits: TextEdit[] = [];

  if (operation.color !== undefined) {
    const edit = updateSettingEdit(declaration, SettingName.Color, operation.color, source);
    if (edit) edits.push(edit);
  }

  if (operation.note === null) {
    const edit = removeNoteEdit(declaration);
    if (edit) edits.push(edit);
  } else if (operation.note !== undefined) {
    const edit = updateNoteEdit(declaration, operation.note) ?? addNoteEdit(declaration, operation.note);
    if (edit) edits.push(edit);
  }

  return edits;
}

/** Compute edits to create a new Dep block (or update if one already carries the edge). */
function computeCreateEdit (dbml: string, operation: DepSyncOperation, definition: DepDefinition | undefined): TextEdit[] {
  if (definition?.kind === 'block') return computeUpdateEdit(operation, definition.declaration, dbml);

  const newBlock = generateDepBlock(operation.edge, operation.color ?? '');
  const createEdit: TextEdit = { start: dbml.length, end: dbml.length, newText: '\n\n' + newBlock + '\n' };

  // If the edge is authored inline, strip the inline setting to avoid duplication.
  if (definition?.kind === 'inline') {
    return [
      { start: definition.fullStart, end: definition.fullEnd, newText: '' },
      createEdit,
    ];
  }

  return [
    createEdit,
  ];
}
