import type Compiler from '@/compiler';
import { Filepath, type FilepathId } from '@/compiler/projectLayout';
import type { Database, Model } from '@/core/interpreter/types';
import type { CompileError, CompileWarning } from '@/core/errors';
import Interpreter from '@/core/interpreter/interpreter';
import Report from '@/core/report';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Model> {
  // 1. Collect all files in dependency graph (entry file first)
  const visited = new Set<FilepathId>();
  const fileOrder: Filepath[] = [];

  const collectDependencies = (fp: Filepath) => {
    const id = fp.intern();
    if (visited.has(id)) return;
    visited.add(id);
    fileOrder.push(fp);

    const deps = this.localFileDependencies(fp);
    for (const [depId] of deps) {
      collectDependencies(Filepath.from(depId));
    }
  };
  collectDependencies(filepath);

  // 2. Interpret each file independently
  const databases: Database[] = [];
  const allErrors: CompileError[] = [];
  const allWarnings: CompileWarning[] = [];

  for (const fp of fileOrder) {
    const { db, errors, warnings } = interpretSingle(this, fp);
    databases.push(db);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  }

  return new Report({ databases }, allErrors, allWarnings);
}

function interpretSingle (compiler: Compiler, filepath: Filepath): {
  db: Database; errors: CompileError[]; warnings: CompileWarning[];
} {
  const { ast } = compiler.parseFile(filepath).getValue();
  const bound = compiler.analyzeFile(filepath);
  const errors = [...bound.getErrors()];
  const warnings = [...bound.getWarnings()];

  if (errors.length > 0) {
    return { db: emptyDatabase(filepath), errors, warnings };
  }

  const { nodeToSymbol, nodeToReferee, symbolToReferences } = bound.getValue();
  const interpretReport = new Interpreter(
    compiler,
    filepath,
    { ast, nodeToSymbol, nodeToReferee, symbolToReferences },
  ).interpret();

  return {
    db: interpretReport.getValue(),
    errors: [...errors, ...interpretReport.getErrors()],
    warnings: [...warnings, ...interpretReport.getWarnings()],
  };
}

function emptyDatabase (filepath: Filepath): Database {
  return { filepath, schemas: [], tables: [], notes: [], refs: [], enums: [], tableGroups: [], aliases: [], project: {}, tablePartials: [], records: [] };
}
