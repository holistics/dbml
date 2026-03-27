import type Compiler from '@/compiler/index';
import { Filepath, type FilepathId } from '@/compiler/projectLayout';
import type { Database, Model } from '@/core/interpreter/types';
import type { CompileError, CompileWarning } from '@/core/errors';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';

// Interpret files in the project.
// If entrypoint is provided, only that file and its transitive dependencies are interpreted.
// If entrypoint is undefined, all files in the project are interpreted.
export function interpretProject (this: Compiler, entrypoint?: Filepath): Report<Model> {
  const analysisMap = this.analyzeProject(entrypoint);

  if (analysisMap.size === 0) return new Report({ databases: [] }, [], []);

  const databases: Database[] = [];
  const allErrors: CompileError[] = [];
  const allWarnings: CompileWarning[] = [];

  for (const [, report] of analysisMap) {
    const errors = [...report.getErrors()];
    const warnings = [...report.getWarnings()];

    if (errors.length > 0) {
      databases.push(emptyDatabase(report.getValue().ast.filepath));
      allErrors.push(...errors);
      allWarnings.push(...warnings);
      continue;
    }

    const analysisResult = report.getValue();
    const interpretReport = new Interpreter(
      this,
      analysisResult,
    ).interpret();

    databases.push(interpretReport.getValue());
    allErrors.push(...errors, ...interpretReport.getErrors());
    allWarnings.push(...warnings, ...interpretReport.getWarnings());
  }

  return new Report({ databases }, allErrors, allWarnings);
}

function emptyDatabase (filepath: Filepath): Database {
  return { filepath, schemas: [], tables: [], notes: [], refs: [], enums: [], tableGroups: [], aliases: [], project: {}, tablePartials: [], records: [] };
}
