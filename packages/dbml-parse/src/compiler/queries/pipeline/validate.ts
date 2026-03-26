import type Compiler from '../../index';
import { UseDeclarationNode } from '@/core/parser/nodes';
import { Filepath, type FilepathId } from '../../projectLayout';

const DBML_EXT = '.dbml';

// Scan use declarations from the parsed AST to extract external file dependencies.
export function localFileDependencies (this: Compiler, filepath: Filepath): ReadonlyMap<FilepathId, UseDeclarationNode> {
  const { ast } = this.parseFile(filepath).getValue();
  const deps = new Map<FilepathId, UseDeclarationNode>();

  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !node.path) continue;
    const resolved = Filepath.resolve(filepath.dirname, node.path.value);
    const resolvedPath = resolved.absolute.endsWith(DBML_EXT) ? resolved : Filepath.from(resolved.absolute + DBML_EXT);
    deps.set(resolvedPath.intern(), node);
  }

  return deps;
}
