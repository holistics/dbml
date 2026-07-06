import type Compiler from '@/compiler';
import type { Database, MasterDatabase } from '@/core/types/schemaJson';
import type { CompileError, CompileWarning, CompileHint } from '@/core/types/errors';
import { Filepath, type FilepathId } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import Report from '@/core/types/report';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  const {
    ast,
  } = this.parseFile(filepath).getValue();
  const symbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!symbol) return Report.create(undefined);
  return this.interpretSymbol(symbol, filepath).map((v) => (v === UNHANDLED || !v) ? undefined : v as Database);
}

// Interpret all files. Returns raw MasterDatabase
export function interpretProject (this: Compiler): Report<MasterDatabase> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];
  const hints: CompileHint[] = [];

  // Collect all reachable files from all entry points
  const visited = new Set<FilepathId>();
  const allFiles: Filepath[] = [];
  for (const entry of this.layout.getEntrypoints()) {
    for (const file of this.reachableFiles(entry)) {
      const id = file.intern();
      if (visited.has(id)) continue;
      visited.add(id);
      allFiles.push(file);
    }
  }

  // Bind and interpret each file
  const perFile = new Map<string, Database>();
  for (const file of allFiles) {
    const parseResult = this.parseFile(file);
    errors.push(...parseResult.getErrors());
    warnings.push(...parseResult.getWarnings());
    hints.push(...parseResult.getHints());

    const bindResult = this.bindFile(file);
    errors.push(...bindResult.getErrors());
    warnings.push(...bindResult.getWarnings());
    hints.push(...bindResult.getHints());

    const {
      ast,
    } = parseResult.getValue();
    const symbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
    const result = symbol ? this.interpretSymbol(symbol, file) : Report.create(UNHANDLED);
    const db = result.getFiltered(UNHANDLED);
    if (db) {
      perFile.set(file.absolute, db as Database);
    }
    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
    hints.push(...result.getHints());
  }

  const files: Record<string, Database> = {};

  for (const [
    fileId,
    db,
  ] of perFile) {
    files[fileId] = db;
  }

  return new Report({
    files,
  }, errors, warnings, hints);
}
