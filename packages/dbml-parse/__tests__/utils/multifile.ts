import Compiler from '@/compiler/index';
import { Filepath, MemoryProjectLayout } from '@/compiler/projectLayout';
import { Model } from '@/index';
import Report from '@/core/report';

export function compileFile (project: Record<string, string>): Report<Model> {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(project)) {
    entries[Filepath.from(path).absolute] = content;
  }
  return new Compiler(new MemoryProjectLayout(entries)).interpretProject();
}
