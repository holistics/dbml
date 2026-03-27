import type Compiler from '../../index';
import { Filepath, type FilepathId } from '../../projectLayout';
import { UseDeclarationNode } from '@/core/parser/nodes';

const DBML_EXT = '.dbml';

// Scan use declarations from the parsed AST to extract external file dependencies.
// Returns a set of resolved filepath IDs. Validates that paths are relative and appends .dbml if missing.
export function localFileDependencies (this: Compiler, filepath: Filepath): Set<FilepathId> {
  const { ast } = this.parseFile(filepath).getValue();
  const deps = new Set<FilepathId>();

  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !node.path) continue;
    if (!Filepath.isRelative(node.path.value)) continue;
    const resolved = Filepath.resolve(filepath.dirname, node.path.value);
    const resolvedPath = resolved.absolute.endsWith(DBML_EXT) ? resolved : Filepath.from(resolved.absolute + DBML_EXT);
    deps.add(resolvedPath.intern());
  }

  return deps;
}
