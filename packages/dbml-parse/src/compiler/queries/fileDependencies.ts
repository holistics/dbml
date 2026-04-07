import type Compiler from '@/compiler/index';
import { DBML_EXT } from '@/constants';
import { UseDeclarationNode } from '@/core/parser/nodes';
import { Filepath, type FilepathId } from '@/core/types/filepath';

// Returns a set of resolved filepath IDs. Validates that paths are relative and appends .dbml if missing.
export function fileDependencies (this: Compiler, filepath: Filepath): Set<FilepathId> {
  const { ast } = this.parseFile(filepath).getValue();
  const deps = new Set<FilepathId>();

  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !node.importPath) continue;
    if (!Filepath.isRelative(node.importPath.value)) continue;
    const resolved = Filepath.resolve(filepath.dirname, node.importPath.value);
    const resolvedPath = resolved.absolute.endsWith(DBML_EXT) ? resolved : Filepath.from(resolved.absolute + DBML_EXT);
    deps.add(resolvedPath.intern());
  }

  return deps;
}
