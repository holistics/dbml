import type Compiler from '@/compiler/index';
import {
  Filepath, type FilepathId,
} from '@/core/types/filepath';

export function reachableFiles (this: Compiler, entry?: Filepath): Filepath[] {
  const visited = new Set<FilepathId>();
  const results: Filepath[] = [];
  const queue = entry
    ? [
        entry,
      ]
    : this.layout.getEntrypoints();
  let head = 0;

  while (head < queue.length) {
    const current = queue[head++];
    const id = current.intern();
    if (visited.has(id)) continue;
    visited.add(id);
    results.push(current);

    for (const dep of this.fileDependencies(current)) {
      queue.push(dep);
    }
  }

  return results;
}
