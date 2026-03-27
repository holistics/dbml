import type Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import type { Database, Model } from '@/core/interpreter/types';
import type { CompileError, CompileWarning } from '@/core/errors';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';
import { collectTransitiveDependencies } from './analyze/index';

// Interpret files in the project.
// If entrypoint is provided, only that file and its transitive dependencies are interpreted.
// If entrypoint is undefined, all files in the project are interpreted.
export function interpretProject (this: Compiler, entrypoint?: Filepath): Report<Model> {
  const files = entrypoint
    ? collectTransitiveDependencies(this, entrypoint)
    : this.layout().listAllFiles();

  if (files.length === 0) return new Report({ databases: [] }, [], []);

  const analysisReport = this.analyzeProject(entrypoint);
  const analysisResult = analysisReport.getValue();

  if (analysisReport.getErrors().length > 0) {
    return new Report(
      { databases: files.map((fp) => emptyDatabase(fp)) },
      analysisReport.getErrors(),
      analysisReport.getWarnings(),
    );
  }

  const databases: Database[] = [];
  const allErrors: CompileError[] = [];
  const allWarnings: CompileWarning[] = [...analysisReport.getWarnings()];

  for (const file of files) {
    const { ast } = this.parseFile(file).getValue();
    const interpretReport = new Interpreter(
      this,
      { ast, ...analysisResult },
    ).interpret();

    databases.push(interpretReport.getValue());
    allErrors.push(...interpretReport.getErrors());
    allWarnings.push(...interpretReport.getWarnings());
  }

  return new Report({ databases }, allErrors, allWarnings);
}

function emptyDatabase (filepath: Filepath): Database {
  return { filepath, schemas: [], tables: [], notes: [], refs: [], enums: [], tableGroups: [], aliases: [], project: {}, tablePartials: [], records: [] };
}
