import type Compiler from '@/compiler/index';
import {
  Filepath, resolveImportFilepath,
} from '@/core/types/filepath';
import {
  UseDeclarationNode,
} from '@/core/types/nodes';

// Returns resolved Filepath objects for each `use { … } from './…'` in the file.
export function fileDependencies (this: Compiler, filepath: Filepath): Filepath[] {
  const {
    ast,
  } = this.parseFile(filepath).getValue();
  const deps: Filepath[] = [];
  const seen = new Set<string>();

  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !node.importPath) continue;
    const resolvedPath = resolveImportFilepath(filepath, node.importPath.value);
    if (!resolvedPath || seen.has(resolvedPath.absolute)) continue;
    seen.add(resolvedPath.absolute);
    deps.push(resolvedPath);
  }

  return deps;
}
