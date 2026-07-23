import { UNHANDLED } from '@/core/types/module';
import type Compiler from '@/compiler/index';
import type { Filepath, FilepathId } from '@/core/types/filepath';
import type { MetadataValues, TokenPosition } from '@/core/types/schemaJson';
import type { NodeSymbol } from '@/core/types/symbol';
import type { MetadataFieldRegistry, MetadataTarget } from './metadataField';
import { getProgramSymbol } from '../utils';

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
