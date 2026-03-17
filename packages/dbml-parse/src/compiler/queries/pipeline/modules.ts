import type Compiler from '../../index';
import { Filepath } from '../../projectLayout';
import { dirname } from 'path';

export type ModuleIndex = {
  // The *.project.dbml file that declares this module, or undefined if the root has none
  entry: Filepath | undefined;
  // Absolute path of the module's root directory
  dir: string;
  // All .dbml files that belong to this module
  // (includes files in subdirectories that don't define their own module)
  files: Filepath[];
};

const ROOT = Filepath.from('/');

export function detectModules (this: Compiler): ModuleIndex[] {
  const layout = this.layout();
  const allDbmlFiles = layout.listAllFiles(ROOT).filter((f) => f.extname === '.dbml');

  // Collect module directories: every folder with a *.project.dbml, plus root (always a module)
  const moduleEntries = new Map<string, Filepath | undefined>();
  moduleEntries.set(ROOT.absolute, undefined);

  for (const file of allDbmlFiles) {
    if (file.basename.endsWith('.project.dbml')) {
      moduleEntries.set(file.dirname, file);
    }
  }

  // Initialize one ModuleIndex per module directory
  const modules = new Map<string, ModuleIndex>();
  for (const [dir, entry] of moduleEntries) {
    modules.set(dir, { entry, dir, files: [] });
  }

  // Assign each .dbml file to the nearest ancestor module directory
  for (const file of allDbmlFiles) {
    const moduleDir = findNearestModuleDir(file.dirname, modules);
    if (moduleDir !== undefined) {
      modules.get(moduleDir)!.files.push(file);
    }
  }

  return [...modules.values()];
}

function findNearestModuleDir (dir: string, modules: Map<string, ModuleIndex>): string | undefined {
  let current = dir;
  while (true) {
    if (modules.has(current)) return current;
    const parent = dirname(current);
    if (parent === current) return undefined; // reached filesystem root with no module found
    current = parent;
  }
}
