import type Compiler from '../../index';
import { Filepath, type FilepathKey } from '../../projectLayout';
import type { Module } from './modules';

export function dirToKey (dir: Filepath) {
  return dir.key;
}

// Walk up the directory tree to find the nearest ancestor module
// Signature: (dir: Filepath) => Module | undefined
export function parentModule (this: Compiler, dir: Filepath): Module | undefined {
  const allModules = this.modules().getValue();
  const byKey = new Map(allModules.map((m) => [m.dir.key, m]));

  let current = dir.dirname as FilepathKey; // start above dir itself
  while (true) {
    const found = byKey.get(current);
    if (found) return found;
    const parent = Filepath.from(current).dirname as FilepathKey;
    if (parent === current) return undefined; // reached filesystem root
    current = parent;
  }
}

// Direct children in the module tree: modules whose parentModule is dir
// Signature: (dir: Filepath) => Module[]
export function childModules (this: Compiler, dir: Filepath): Module[] {
  return this.modules().getValue().filter(
    (m) => !m.dir.equals(dir) && this.parentModule(m.dir)?.dir.key === dir.key,
  );
}

// All ancestors ordered from nearest to root
// Signature: (dir: Filepath) => Module[]
export function ancestorModules (this: Compiler, dir: Filepath): Module[] {
  const result: Module[] = [];
  let current = this.parentModule(dir);
  while (current) {
    result.push(current);
    current = this.parentModule(current.dir);
  }
  return result;
}

// All descendants at any depth: modules whose dir is a subdirectory of dir
// Signature: (dir: Filepath) => Module[]
export function descendantModules (this: Compiler, dir: Filepath): Module[] {
  const prefix = dir.absolute.endsWith('/') ? dir.absolute : `${dir.absolute}/`;
  return this.modules().getValue().filter(
    (m) => !m.dir.equals(dir) && m.dir.absolute.startsWith(prefix),
  );
}
