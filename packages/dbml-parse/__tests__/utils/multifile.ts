import Compiler from '@/compiler/index';
import { Filepath, MemoryProjectLayout } from '@/compiler/projectLayout';
import { Database } from '@/index';
import Report from '@/core/report';

export function compileFile (project: Record<string, string>): Report<Database> {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(project)) {
    entries[Filepath.from(path).absolute] = content;
  }
  const report = new Compiler(new MemoryProjectLayout(entries)).interpretProject();
  return new Report(report.getValue().items, report.getErrors(), report.getWarnings());
}
