import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type Compiler from '@/compiler/index';
import {
  Filepath, FilepathId, SettingName, UNHANDLED,
} from '@/core/types';
import type {
  Column, MetadataValues, Note, Ref, Table, TableGroup, TokenPosition,
} from '@/core/types/schemaJson';
import { ElementKind } from '@/core/types/keywords';
import { ElementDeclarationNode, SyntaxNode } from '@/core/types/nodes';
import {
  NodeSymbol, SymbolKind, MetadataTargetKind, RefSymbol, type ProgramSymbol,
} from '@/core/types/symbol';
import { destructureComplexVariable } from '@/core/utils/expression';
import { isElementNode } from '@/core/utils/validate';
import { getMetadataTargetKind } from '@/core/local_modules/metadata/utils';
import { getDefaultSchemaSymbol, getProgramSymbol } from '../utils';

export type MetadataTarget = Table | TableGroup | Note | Column | Ref;

/**
  * Specs for builtin metadata (table's note, tablegroup's color, .etc) for different element types. Does 2 things:
  * - `validate`: Validating if the metadata value is syntactically correct
  * - `assign`: Write the metadata value to the element builtin props (e.g. write `table.note` instead of `table.metadata`)
  */
interface MetadataField<T extends MetadataTarget> {
  /** Check if the metadata value is syntactically correct */
  isValidBuiltinFieldValue (node?: SyntaxNode): boolean;
  message: string;

  /** Write the metadata value to the element builtin props (e.g. write to `table.note`) */
  assignBuiltinField (element: Partial<T>, value: string, token: TokenPosition): void;
}

// A per-kind registry: exactly the promotable settings for that kind, each carrying its own validate + assign. K is tightened per kind.
export type MetadataFieldRegistry<T extends MetadataTarget, K extends SettingName = SettingName> = Record<K, MetadataField<T>>;

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
    // Kept for exhaustiveness only: Ref targets are resolved by resolveRefMetadataCandidates, never through schemas
    case MetadataTargetKind.Ref:
      kindParts = [...Array(nameParts.length - 1).fill(SymbolKind.Schema), SymbolKind.Ref];
      break;
    // Exhaustiveness checking
    default: {
      const _: never = targetKind;
      break;
    }
  }

  return nameParts.map((namePart, idx) => ({ name: namePart, symbolKind: kindParts[idx] }));
}

/**
  * Named refs visible from a program: refs are not imported via `use`, a ref is visible wherever it shows up in the output,
  * i.e. its RefMetadata is owned by the program (the program reaches the ref's file and sees both endpoint tables).
  *
  * NOTE: Scans declarations directly instead of `symbolMetadata`, as this runs while the resolution index is being built.
  */
export function visibleNamedRefs (compiler: Compiler, programSymbol: ProgramSymbol): RefSymbol[] {
  return compiler.reachableFiles(programSymbol.filepath).flatMap((filepath) => {
    const { ast } = compiler.parseFile(filepath).getValue();
    return ast.body.flatMap((node) => {
      if (!isElementNode(node, ElementKind.Ref)) return [];
      const symbol = compiler.nodeSymbol(node).getFiltered(UNHANDLED);
      if (!(symbol instanceof RefSymbol)) return [];
      const refMetadata = compiler.nodeMetadata(node).getFiltered(UNHANDLED);
      if (!refMetadata?.owners(compiler).includes(programSymbol)) return [];
      return [symbol];
    });
  });
}

/** Every visible named ref a `Metadata Ref <name>` header may refer to. More than one means the name is ambiguous. */
export function resolveRefMetadataCandidates (compiler: Compiler, metadataNode: ElementDeclarationNode): RefSymbol[] {
  const programSymbol = getProgramSymbol(compiler, metadataNode.filepath);
  if (!programSymbol) return [];

  const nameParts = destructureComplexVariable(metadataNode.name);
  if (nameParts?.length !== 1) return [];

  return visibleNamedRefs(compiler, programSymbol).filter((ref) => ref.name === nameParts[0]);
}

// Resolve the target element a Metadata declaration annotates, from its `<target-kind> <name>` header
export function resolveMetadataTarget (compiler: Compiler, metadataNode: ElementDeclarationNode): NodeSymbol | undefined {
  const globalSymbol = getProgramSymbol(compiler, metadataNode.filepath);
  if (!globalSymbol) return undefined;

  const targetKind = getMetadataTargetKind(metadataNode);
  const nameParts = destructureComplexVariable(metadataNode.name);
  if (!nameParts?.length || !targetKind) return undefined;

  if (targetKind === MetadataTargetKind.Ref) {
    const candidates = resolveRefMetadataCandidates(compiler, metadataNode);
    return candidates.length === 1 ? candidates[0] : undefined;
  }

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

  const valueSets = orderedMetas
    .map((m) => compiler.interpretMetadata(m, filepath).getFiltered(UNHANDLED))
    .filter((v) => !!v) as MetadataValues[];
  if (!valueSets.length) return;

  const lowerKeyMap: Record<string, { originalKey: string; value: string; token: TokenPosition }> = {};
  for (const values of valueSets) {
    for (const [originalKey, { value, token }] of Object.entries(values)) {
      lowerKeyMap[originalKey.toLowerCase()] = { originalKey, value, token };
    }
  }

  // Start value is inline metadata (interpreted at element interpreter), then metadata in custom block override keys with same lowercase value
  const mergedMetadata = targetElement.metadata
    ? Object.fromEntries(Object.entries(targetElement.metadata).map(([originalKey, value]) => [originalKey.toLowerCase(), { originalKey, value }]))
    : {};

  Object.entries(lowerKeyMap).forEach(([lowerCaseKey, metadata]) => {
    const { originalKey, value, token } = metadata;

    if (fieldsRegistry[lowerCaseKey]) fieldsRegistry[lowerCaseKey].assignBuiltinField(targetElement, value, token);
    else mergedMetadata[lowerCaseKey] = { originalKey, value };
  });

  targetElement.metadata = Object.fromEntries(Object.values(mergedMetadata).map((v) => [v.originalKey, v.value]));
}
