import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type Compiler from '@/compiler/index';
import {
  CompileErrorCode,
  Filepath, FilepathId, SettingName, UNHANDLED,
} from '@/core/types';
import type {
  Column, CustomMetadata, CustomMetadataValue, CustomMetadataValueType, Note, Table, TableGroup, TokenPosition,
} from '@/core/types/schemaJson';
import { ElementDeclarationNode, SyntaxNode } from '@/core/types/nodes';
import { NodeSymbol, SymbolKind, MetadataTargetKind } from '@/core/types/symbol';
import { destructureComplexVariable } from '@/core/utils/expression';
import { getMetadataTargetKind } from '@/core/local_modules/metadata/utils';
import { getDefaultSchemaSymbol, getProgramSymbol } from '../utils';

export type MetadataTarget = Table | TableGroup | Note | Column;

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
  /** Whether the source node is a valid value for this field */
  isValid (node?: SyntaxNode): boolean;
  invalidError: { code: CompileErrorCode; message: string };
  /** Whether the field may appear more than once in an inline settings list */
  allowDuplicate: boolean;
  duplicateError?: { code: CompileErrorCode; message: string };
  message: string;

  /** Write the parsed value to the element builtin props (e.g. write to `table.note`) */
  assign (element: Partial<T>, value: V, token: TokenPosition): void;
};

// A per-kind registry: exactly the promotable settings for that kind, each carrying its own parse + assign. K is tightened per kind.
export type MetadataFieldRegistry<T extends MetadataTarget, R extends { [K in SettingName]?: CustomMetadataValue['value'] }> = { [K in keyof R]: MetadataField<T, R[K]> };

type NameWithSymbolKind = {
  name: string;
  symbolKind: SymbolKind;
};

function lookupSymbol (compiler: Compiler, startSymbol: NodeSymbol, namePartAndSymbolKind: NameWithSymbolKind[]): NodeSymbol | undefined {
  if (!namePartAndSymbolKind.length) return undefined;

  const { name, symbolKind } = namePartAndSymbolKind[0];
  const symbol = compiler.lookupMembers(startSymbol, symbolKind, name);

  if (namePartAndSymbolKind.length > 1 && symbol) return lookupSymbol(compiler, symbol, namePartAndSymbolKind.slice(1));

  return symbol;
}

/** @internal Exported for testing only. */
export function mapNamePartToSymbolKind (nameParts: string[], targetKind: MetadataTargetKind): NameWithSymbolKind[] {
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

// Resolve the target element a Metadata declaration annotates, from its `<target-kind> <name>` header
export function resolveMetadataTarget (compiler: Compiler, metadataNode: ElementDeclarationNode): NodeSymbol | undefined {
  const globalSymbol = getProgramSymbol(compiler, metadataNode.filepath);
  if (!globalSymbol) return undefined;

  const targetKind = getMetadataTargetKind(metadataNode);
  const nameParts = destructureComplexVariable(metadataNode.name);
  if (!nameParts?.length || !targetKind) return undefined;

  const namePartAndSymbolKind = mapNamePartToSymbolKind(nameParts, targetKind);

  const { name: startName, symbolKind: startSymbolKind } = namePartAndSymbolKind[0];

  if (startName === DEFAULT_SCHEMA_NAME && startSymbolKind === SymbolKind.Schema) {
    const defaultSchema = getDefaultSchemaSymbol(compiler, globalSymbol);
    if (defaultSchema) return lookupSymbol(compiler, defaultSchema, namePartAndSymbolKind.slice(1));
  }

  return lookupSymbol(compiler, globalSymbol, namePartAndSymbolKind);
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

/** Merge every custom-metadata block, reachable from the current program, targeting element to it's `metadata` and other builtin (note/headercolor/...) fields */
export function attachCustomMetadata<T extends MetadataTarget> (
  compiler: Compiler,
  targetElement: Partial<T>,
  targetSymbol: NodeSymbol,
  fieldsRegistry: MetadataFieldRegistry<T, any>,
  filepath: Filepath,
) {
  const programSymbol = getProgramSymbol(compiler, filepath);
  if (!programSymbol) return;

  const metas = compiler.symbolMetadata(targetSymbol).filter((m) => m.owners(compiler).includes(programSymbol));
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
