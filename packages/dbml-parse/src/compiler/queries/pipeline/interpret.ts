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
  let entryErrors: CompileError[] = [];
  let entryWarnings: CompileWarning[] = [];
  const entryId = filepath.intern();

  for (const fp of fileOrder) {
    const { db, errors, warnings } = interpretSingle(this, fp);
    databases.push(db);

    if (fp.intern() === entryId) {
      entryErrors = errors;
      entryWarnings = warnings;
    }
  }

  return new Report({ database: databases }, entryErrors, entryWarnings);
}

function interpretSingle (compiler: Compiler, filepath: Filepath): {
  db: Database; errors: CompileError[]; warnings: CompileWarning[];
} {
  const fileIndex = compiler.parseFile(filepath);
  const bound = compiler.bindFile(filepath);
  const errors = [...bound.getErrors()];
  const warnings = [...bound.getWarnings()];

  if (errors.length > 0) {
    return { db: emptyDatabase(filepath), errors, warnings };
  }

  const { nodeToSymbol, nodeToReferee, symbolToReferences } = bound.getValue();
  const interpretReport = new Interpreter({ ast: fileIndex.ast, nodeToSymbol, nodeToReferee, symbolToReferences }).interpret();

  return {
    db: interpretReport.getValue(),
    errors: [...errors, ...interpretReport.getErrors()],
    warnings: [...warnings, ...interpretReport.getWarnings()],
  };
}

function emptyDatabase (filepath: Filepath): Database {
  return { filepath, schemas: [], tables: [], notes: [], refs: [], enums: [], tableGroups: [], aliases: [], project: {}, tablePartials: [], records: [] };
}
