import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Compiler } from '@/index';
import { Filepath } from '@/core/types/filepath';

function getFilesRecursively (dir: string): string[] {
  const files: string[] = [];
  const items = readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    if (statSync(fullPath).isDirectory()) {
      files.push(...getFilesRecursively(fullPath));
    } else {
      files.push(fullPath);
    }
  }
  return files;
}

// Load all .dbml files from a sample project dir into a Compiler
export function loadProject (projectName: string): { compiler: Compiler; files: Map<string, Filepath> } {
  const dir = path.resolve(__dirname, projectName);
  const dbmlFiles = getFilesRecursively(dir).filter((f) => f.endsWith('.dbml'));

  const compiler = new Compiler();
  const files = new Map<string, Filepath>();

  for (const file of dbmlFiles) {
    const relativePath = file.slice(dir.length);
    const filepath = Filepath.from(relativePath);
    const source = readFileSync(file, 'utf-8');
    compiler.setSource(filepath, source);
    files.set(relativePath.startsWith('/') ? relativePath.slice(1) : relativePath, filepath);
  }

  return { compiler, files };
}

export function loadAllSampleProjects (): { compiler: Compiler; files: Map<string, Filepath>, name: string}[] {
  const allProjects = readdirSync(__dirname).filter((p) => {
    // Only include directories, not files
    const fullPath = path.join(__dirname, p);
    return statSync(fullPath).isDirectory();
  });
  const res = [];
  for (const project of allProjects) {
    res.push({ ...loadProject(project), name: project });
  }
  return res;
}
