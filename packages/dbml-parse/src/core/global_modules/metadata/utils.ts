import type Compiler from '@/compiler/index';
import {
  Filepath, FilepathId, SettingName, UNHANDLED,
} from '@/core/types';
import type {
  Column, CustomMetadata, CustomMetadataValue, CustomMetadataValueType, Note, Ref, Table, TableGroup, TokenPosition,
} from '@/core/types/schemaJson';
import type { SyntaxNode } from '@/core/types/nodes';
import {
  NodeSymbol, SymbolKind, MetadataTargetKind, ProgramSymbol, MetadataElementMetadata,
} from '@/core/types/symbol';
import { getProgramSymbol } from '../utils';

export type MetadataTarget = Table | TableGroup | Note | Column | Ref;

/**
  * Spec for one builtin metadata field (table's note, tablegroup's color, .etc) of an element kind.
  * Used for both the inline settings list and Metadata blocks:
  * - `parse`: Read the field's own value from a source node, `undefined` means the value is invalid
  * - `assign`: Write the parsed value to the element builtin props (e.g. write `table.note` instead of `table.metadata`)
  */
type MetadataField<T, V> = {
  /** Type of the parsed value, reported when the field is read as a metadata entry */
  type: CustomMetadataValueType;
  /** Parse the source node into the field's value, `undefined` if the node is not a valid value for this field */
  parse (node?: SyntaxNode): V | undefined;
  message: string;

  /** Write the parsed value to the element builtin props (e.g. write to `table.note`) */
  assign (element: Partial<T>, value: V, token: TokenPosition): void;
};

// A per-kind registry: exactly the promotable settings for that kind, each carrying its own parse + assign. K is tightened per kind.
export type MetadataFieldRegistry<T extends MetadataTarget, R extends { [K in SettingName]?: CustomMetadataValue['value'] }> = { [K in keyof R]: MetadataField<T, R[K]> };

export type NameWithSymbolKind = {
  name: string;
  symbolKind: SymbolKind;
};

/** @internal Exported for testing only. */
export function mapNamePartToSymbolKind (nameParts: string[], targetKind: Exclude<MetadataTargetKind, MetadataTargetKind.Ref>): NameWithSymbolKind[] {
  if (nameParts.length === 0) return [];

  let kindParts: SymbolKind[];

  switch (targetKind) {
    case MetadataTargetKind.Table:
      kindParts = [...Array(nameParts.length - 1).fill(SymbolKind.Schema), SymbolKind.Table];
      break;
    case MetadataTargetKind.Column:
      if (nameParts.length === 1) kindParts = [SymbolKind.Column];
      else kindParts = [...Array(nameParts.length - 2).fill(SymbolKind.Schema), SymbolKind.Table, SymbolKind.Column];
      break;
    case MetadataTargetKind.TableGroup:
      kindParts = [...Array(nameParts.length - 1).fill(SymbolKind.Schema), SymbolKind.TableGroup];
      break;
    case MetadataTargetKind.Note:
      kindParts = [...Array(nameParts.length - 1).fill(SymbolKind.Schema), SymbolKind.StickyNote];
      break;
    // Exhaustiveness checking
    default: {
      const _: never = targetKind;
      break;
    }
  }

  return nameParts.map((namePart, idx) => ({ name: namePart, symbolKind: kindParts[idx] }));
}

/** Get precedence score of files in import tree, lower score means lower precedence */
function metadataFilePrecedence (compiler: Compiler, root: Filepath): Map<FilepathId, number> {
  const sequence: Filepath[] = [];
  const visited = new Set<FilepathId>();

  const visit = (filepath: Filepath) => {
    const id = filepath.intern();
    if (visited.has(id)) return;
    visited.add(id);
    for (const dep of compiler.fileDependencies(filepath)) visit(dep);
    sequence.push(filepath);
  };

  visit(root);

  const ranks = new Map<FilepathId, number>();
  sequence.forEach((filepath, index) => ranks.set(filepath.intern(), index));
  return ranks;
}

/**
  * Merge every custom-metadata block applying to the target in the current program (in precedence order) to its `metadata` and other builtin (note/headercolor/...) fields
  * NOTE: Only run during interpret phase
  */
export function attachCustomMetadata<T extends MetadataTarget> (
  compiler: Compiler,
  targetElement: Partial<T>,
  targetSymbol: NodeSymbol,
  fieldsRegistry: MetadataFieldRegistry<T, any>,
  filepath: Filepath,
) {
  const programSymbol = getProgramSymbol(compiler, filepath);
  if (!programSymbol) return;

  if (!compiler.isSymbolVisible(programSymbol, targetSymbol)) return;

  const reachableFiles = new Set(compiler.reachableFiles(programSymbol.filepath).map((f) => f.absolute));

  const metas = compiler
    .symbolMetadata(targetSymbol)
    .filter((m): m is MetadataElementMetadata => m instanceof MetadataElementMetadata)
    .filter((m) => reachableFiles.has(m.declaration.filepath.absolute));
  if (!metas.length) return;

  const precedence = metadataFilePrecedence(compiler, filepath);
  const orderedMetas = [...metas].sort((a, b) => {
    const rankA = precedence.get(a.declaration.filepath.intern()) ?? -1;
    const rankB = precedence.get(b.declaration.filepath.intern()) ?? -1;
    if (rankA !== rankB) return rankA - rankB;
    return a.declaration.start - b.declaration.start;
  });

  const blocks = orderedMetas
    .map((m) => compiler.interpretMetadata(m, filepath).getFiltered(UNHANDLED))
    .filter((v) => !!v) as CustomMetadata[];
  if (!blocks.length) return;

  // Blocks are already parsed against their target kind's fields, so a later block's (valid) entry simply overrides an earlier one
  const lowerKeyMap: Record<string, { originalKey: string; entry: CustomMetadataValue }> = {};
  for (const block of blocks) {
    for (const [originalKey, entry] of Object.entries(block)) {
      lowerKeyMap[originalKey.toLowerCase()] = { originalKey, entry };
    }
  }

  // Start value is inline metadata (interpreted at element interpreter), then metadata in custom block override keys with same lowercase value
  const mergedMetadata: Record<string, { originalKey: string; entry: CustomMetadataValue }> = targetElement.metadata
    ? Object.fromEntries(Object.entries(targetElement.metadata).map(([originalKey, entry]) => [originalKey.toLowerCase(), { originalKey, entry }]))
    : {};

  Object.entries(lowerKeyMap).forEach(([lowerCaseKey, { originalKey, entry }]) => {
    const field = fieldsRegistry[lowerCaseKey];
    if (field) field.assign(targetElement, entry.value, entry.token);
    else mergedMetadata[lowerCaseKey] = { originalKey, entry };
  });

  targetElement.metadata = Object.fromEntries(Object.values(mergedMetadata).map((v) => [v.originalKey, v.entry]));
}
