import type Compiler from '@/compiler/index';
import {
  Filepath, type FilepathId,
} from '@/core/types/filepath';

export function reachableFiles (this: Compiler, entry: Filepath): Set<Filepath> {
  const visited = new Set<FilepathId>();
  const results = new Set<Filepath>();
  const queue = [
    entry,
  ];

  while (queue.length > 0) {
    const current = queue.shift()!;
    const id = current.intern();
    if (visited.has(id)) continue;
    visited.add(id);
    results.add(current);

    const deps = this.fileDependencies(current);
    for (const depId of deps) {
      const depPath = new Filepath(depId);
      queue.push(depPath);
    }
  }

  return results;
}
