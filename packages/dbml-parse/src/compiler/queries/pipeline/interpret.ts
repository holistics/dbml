import Interpreter from '@/core/global_modules/program/interpret';
import type {
  Filepath,
} from '@/core/types/filepath';
import type {
  Database,
  MasterDatabase,
} from '@/core/types/schemaJson';
import Report from '@/core/types/report';
import type Compiler from '../../index';
import {
  CompileError, CompileWarning,
} from '@/core/types';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  const bindResult = this.bindFile(filepath);
  if (bindResult.getErrors().length > 0) {
    return bindResult.map(() => undefined);
  }
  const {
    ast,
  } = this.parseFile(filepath).getValue();
  return bindResult.chain(() => new Interpreter(ast).interpret());
}

export function interpretProject (this: Compiler): Report<Readonly<MasterDatabase> | undefined> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  // Collect all reachable files from all entry points
  const allFiles: Filepath[] = this.layout.getEntryPoints();

  // Interpret each file
  const perFile = new Map<string, Database>();
  for (const file of allFiles) {
    const result = this.interpretFile(file);
    errors.push(...result.getErrors());
    warnings.push(...result.getWarnings());
    const db = result.getValue();
    if (db) {
      perFile.set(file.absolute, db);
    }
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
  }, errors, warnings);
}
