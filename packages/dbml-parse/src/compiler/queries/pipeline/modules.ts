import type Compiler from '../../index';
import { Filepath } from '../../projectLayout';
import { ROOT, DBML_EXT, PROJECT_FILE_EXT } from '../../constants';
import { CompileError, CompileErrorCode } from '@/core/errors';
import Report from '@/core/report';
import { dirname } from 'path';

export type Module = {
  // The *.project.dbml file that declares this module, or undefined if the root has none
  entry: Filepath | undefined;
  // The module name - stem of the entry basename (e.g. 'auth' from 'auth.project.dbml'),
  // or undefined if the root has no entry
  name: string | undefined;
  // Absolute path of the module's root directory
  dir: string;
  // All .dbml files that belong to this module
  // (includes files in subdirectories that don't define their own module)
  files: Filepath[];
};

export function modules (this: Compiler): Report<Module[]> {
  const errors: CompileError[] = [];
  const layout = this.layout();
  const allDbmlFiles = layout.listAllFiles(ROOT).filter((f) => f.extname === DBML_EXT);

  // Group *.project.dbml files by directory to detect duplicates
  const projectFilesByDir = new Map<string, Filepath[]>();
  for (const file of allDbmlFiles) {
    if (file.basename.endsWith(PROJECT_FILE_EXT)) {
      const dir = file.dirname;
      if (!projectFilesByDir.has(dir)) projectFilesByDir.set(dir, []);
      projectFilesByDir.get(dir)!.push(file);
    }
  }

  // Collect module entries — root is always a module; report errors for duplicate project files
  const moduleEntries = new Map<string, Filepath | undefined>();
  moduleEntries.set(ROOT.absolute, undefined);

  for (const [dir, files] of projectFilesByDir) {
    if (files.length > 1) {
      for (const file of files) {
        const ast = this.parseFile(file).ast;
        errors.push(new CompileError(
          CompileErrorCode.DUPLICATE_MODULE_ENTRY,
          `Folder "${dir}" has multiple *.project.dbml files; only one is allowed`,
          ast,
        ));
      }
    } else {
      moduleEntries.set(dir, files[0]);
    }
  }

  // Initialize one Module per module directory
  const result = new Map<string, Module>();
  for (const [dir, entry] of moduleEntries) {
    const name = entry ? entry.basename.slice(0, -PROJECT_FILE_EXT.length) : undefined;
    result.set(dir, { entry, name, dir, files: [] });
  }

  // Assign each .dbml file to the nearest ancestor module directory
  for (const file of allDbmlFiles) {
    const moduleDir = findNearestModuleDir(file.dirname, result);
    if (moduleDir !== undefined) {
      result.get(moduleDir)!.files.push(file);
    }
  }

  return new Report([...result.values()], errors);
}

function findNearestModuleDir (dir: string, modules: Map<string, Module>): string | undefined {
  let current = dir;
  while (true) {
    if (modules.has(current)) return current;
    const parent = dirname(current);
    if (parent === current) return undefined; // reached filesystem root with no module found
    current = parent;
  }
}
