import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type { Filepath } from '@/core/types/filepath';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
} from '@/core/types/nodes';
import { SymbolKind } from '@/core/types/symbol';
import { MetadataTargetKind } from '@/core/types/symbol/symbols';
import { ElementKind } from '@/core/types';
import { isElementNode } from '@/core/utils/validate';
import { destructureComplexVariable } from '@/core/utils/expression';
import { getMetadataTargetKind } from '@/core/local_modules/metadata/utils';
import type Compiler from '../../index';
import { applyTextEdits, type TextEdit } from './applyTextEdits';
import type { ElementIdentifier } from './types';
import { lookupElementSymbol, normalizeSchema } from './utils';
import { formatTypedValue, type TypedValue } from '../utils';

// Map each Metadata-supported element kind to its MetadataTargetKind
function toMetadataTargetKind (kind: string): MetadataTargetKind | undefined {
  switch (kind) {
    case SymbolKind.Table:
      return MetadataTargetKind.Table;
    case SymbolKind.Column:
      return MetadataTargetKind.Column;
    case SymbolKind.TableGroup:
      return MetadataTargetKind.TableGroup;
    case SymbolKind.StickyNote:
      return MetadataTargetKind.Note;
    default:
      return undefined;
  }
}

// Build the target name string used in a Metadata block header
// e.g. "public.users" for a table, "public.users.id" for a column
function buildTargetName (target: ElementIdentifier): string | undefined {
  const schema = normalizeSchema(
    'schema' in target ? target.schema : undefined,
  );

  switch (target.kind) {
    case SymbolKind.Table: {
      const t = target as { table: string; schema?: string };
      if (schema === DEFAULT_SCHEMA_NAME) return t.table;
      return `${schema}.${t.table}`;
    }
    case SymbolKind.Column: {
      const c = target as { table: string; column: string; schema?: string };
      if (schema === DEFAULT_SCHEMA_NAME) return `${c.table}.${c.column}`;
      return `${schema}.${c.table}.${c.column}`;
    }
    case SymbolKind.TableGroup:
    case SymbolKind.StickyNote: {
      const n = target as { name: string; schema?: string };
      if (schema === DEFAULT_SCHEMA_NAME) return n.name;
      return `${schema}.${n.name}`;
    }
    default:
      return undefined;
  }
}

// Check if a Metadata block declaration targets the given element identifier
function metadataBlockMatchesTarget (
  node: ElementDeclarationNode,
  targetKind: MetadataTargetKind,
  targetName: string,
): boolean {
  if (getMetadataTargetKind(node) !== targetKind) return false;
  const nameParts = destructureComplexVariable(node.name);
  if (!nameParts) return false;
  return nameParts.join('.').toLowerCase() === targetName.toLowerCase();
}

// Find the Metadata block in `filepath` that targets `target`
// Returns undefined if no such block exists in that file
export function findMetadataBlock (
  this: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
): ElementDeclarationNode | undefined {
  const targetKind = toMetadataTargetKind(target.kind);
  if (!targetKind) return undefined;

  const targetName = buildTargetName(target);
  if (!targetName) return undefined;

  const ast = this.parseFile(filepath).getValue().ast;
  if (!ast) return undefined;

  for (const node of ast.body ?? []) {
    if (!(node instanceof ElementDeclarationNode)) continue;
    if (!isElementNode(node, ElementKind.Metadata)) continue;
    if (metadataBlockMatchesTarget(node, targetKind, targetName)) return node;
  }

  return undefined;
}

// Build the text for a fresh Metadata block with one key-value pair
function buildMetadataBlock (
  targetKindStr: string,
  targetName: string,
  key: string,
  value: string,
): string {
  return `Metadata ${targetKindStr} ${targetName} {\n  ${key}: ${value}\n}`;
}

// Get the human-readable target kind keyword (e.g. "Table", "Column")
function getMetadataTargetKindLabel (targetKind: MetadataTargetKind): string {
  switch (targetKind) {
    case MetadataTargetKind.Table:
      return 'Table';
    case MetadataTargetKind.Column:
      return 'Column';
    case MetadataTargetKind.TableGroup:
      return 'TableGroup';
    case MetadataTargetKind.Note:
      return 'Note';
    default: {
      const _: never = targetKind;
      return targetKind;
    }
  }
}

// Returns TextEdit[] to add/update/remove a single key in the Metadata block for `target`
// - value is non-null: upsert the key (creates the Metadata block if missing), formatted via formatTypedValue
// - value is null: remove the key, removes the entire block if it was the last key
// Returns edits sorted descending by start position (tail-first), safe to apply in order.
export function updateElementMetadataEdit (
  this: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
  key: string,
  value: TypedValue | null,
): TextEdit[] {
  const targetKind = toMetadataTargetKind(target.kind);
  if (!targetKind) return [];

  const targetName = buildTargetName(target);
  if (!targetName) return [];

  const source = this.getSource(filepath) ?? '';
  const block = findMetadataBlock.call(this, filepath, target);

  // No existing block
  if (!block) {
    if (value === null) return [];
    const kindLabel = getMetadataTargetKindLabel(targetKind);
    const newBlock = buildMetadataBlock(
      kindLabel,
      targetName,
      key,
      formatTypedValue(value),
    );
    return [
      {
        start: source.length,
        end: source.length,
        newText: '\n\n' + newBlock + '\n',
      },
    ];
  }

  // Find existing key entry inside the block body
  const children =
    block.body instanceof BlockExpressionNode ? block.body.body : [];
  const existing = children.find(
    (child): child is ElementDeclarationNode =>
      child instanceof ElementDeclarationNode
      && child.type?.value?.toLowerCase() === key.toLowerCase(),
  );

  if (value === null) {
    // Remove: if this was the only key, remove the entire block
    const keyEntries = children.filter(
      (child) => child instanceof ElementDeclarationNode && child.type?.value,
    );
    if (existing) {
      if (keyEntries.length <= 1) {
        // Remove the entire block, including leading whitespace/newlines
        let removeStart = block.start;
        while (
          removeStart > 0
          && (source[removeStart - 1] === '\n'
            || source[removeStart - 1] === '\r'
            || source[removeStart - 1] === ' ')
        ) {
          removeStart--;
        }
        return [{ start: removeStart, end: block.end, newText: '' }];
      }
      return [{ start: existing.start, end: existing.end, newText: '' }];
    }
    return [];
  }

  const settingText = `${key}: ${formatTypedValue(value)}`;

  if (existing) {
    // Update existing key in place
    return [{ start: existing.start, end: existing.end, newText: settingText }];
  }

  // Add new key before the closing brace
  const insertOffset = block.end - 1;
  return [
    { start: insertOffset, end: insertOffset, newText: `  ${settingText}\n` },
  ];
}

// Applies edits and returns the new source, mirrors updateElementSetting
export function updateElementMetadata (
  this: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
  key: string,
  value: TypedValue | null,
): string {
  const source = this.getSource(filepath) ?? '';
  const edits = updateElementMetadataEdit.call(
    this,
    filepath,
    target,
    key,
    value,
  );
  if (edits.length === 0) return source;
  return applyTextEdits(source, edits, true);
}

// Convenience function mirroring the syncDep pattern: returns both the new source and the pre-sorted edits so callers can hand both to writer.applyEdits()
export function syncElementMetadata (
  source: string,
  compiler: Compiler,
  filepath: Filepath,
  target: ElementIdentifier,
  key: string,
  value: TypedValue | null,
): { newDbml: string; edits: TextEdit[] } {
  const edits = updateElementMetadataEdit.call(
    compiler,
    filepath,
    target,
    key,
    value,
  );
  if (edits.length === 0) return { newDbml: source, edits: [] };
  const newDbml = applyTextEdits(source, edits, true);
  return { newDbml, edits };
}
