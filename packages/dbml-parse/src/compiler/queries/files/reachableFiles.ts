import type Compiler from '@/compiler/index';
import { Filepath, type FilepathId } from '@/core/types/filepath';

// BFS-walk the dependency graph from the given roots using fileDependencies
// (a local query). Returns all reachable files in discovery order.
export function walkDependencies (compiler: Compiler, roots: Filepath[]): Filepath[] {
  const visited = new Set<FilepathId>();
  const results: Filepath[] = [];
  const queue = [
    ...roots,
  ];
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const id = current.intern();
    if (visited.has(id)) continue;
    visited.add(id);
    results.push(current);

    for (const dep of compiler.fileDependencies(current)) {
      queue.push(dep);
    }
  }

  return results;
}

export function reachableFiles (this: Compiler, entry?: Filepath): Filepath[] {
  return walkDependencies(this, entry
    ? [
        entry,
      ]
    : this.layout.getEntrypoints());
}
