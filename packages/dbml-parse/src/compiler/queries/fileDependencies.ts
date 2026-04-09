import type Compiler from '@/compiler/index';
import { UseDeclarationNode } from '@/core/parser/nodes';
import { Filepath, resolveImportFilepath, type FilepathId } from '@/core/types/filepath';

// Returns a set of resolved filepath IDs. Validates that paths are relative and appends .dbml if missing.
export function fileDependencies (this: Compiler, filepath: Filepath): Set<FilepathId> {
  const { ast } = this.parseFile(filepath).getValue();
  const deps = new Set<FilepathId>();

  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !node.importPath) continue;
    const resolvedPath = resolveImportFilepath(filepath, node.importPath.value);
    if (!resolvedPath) continue;
    deps.add(resolvedPath.intern());
  }

  return deps;
}
