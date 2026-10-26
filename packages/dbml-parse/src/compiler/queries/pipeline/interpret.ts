import type Compiler from '@/compiler';
import type { Database, MasterDatabase } from '@/core/types/schemaJson';
import {
  CompileError, CompileErrorCode, type CompileWarning, type CompileInfo,
} from '@/core/types/errors';
import { Filepath, type FilepathId } from '@/core/types/filepath';
import { UNHANDLED } from '@/core/types/module';
import { UseDeclarationNode } from '@/core/types/nodes';
import Report from '@/core/types/report';

export function interpretFile (this: Compiler, filepath: Filepath): Report<Readonly<Database> | undefined> {
  const {
    ast,
  } = this.parseFile(filepath).getValue();
  const symbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
  if (!symbol) return Report.create(undefined);
  const result = this.interpretSymbol(symbol, filepath).map((v) => (v === UNHANDLED || !v) ? undefined : v as Database);

  // Check each direct import for errors and highlight the import path
  const importErrors: CompileError[] = [];
  const seen = new Set<string>();
  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !node.importPath) continue;
    const resolvedPath = this.layout.resolveFileSpecifier(filepath, node.importPath.value);
    if (!resolvedPath || seen.has(resolvedPath.absolute)) continue;
    seen.add(resolvedPath.absolute);

    const parseResult = this.parseFile(resolvedPath);
    const importSymbol = this.nodeSymbol(parseResult.getValue().ast).getFiltered(UNHANDLED);
    const hasErrors = parseResult.getErrors().length > 0
      || (importSymbol && this.interpretSymbol(importSymbol, resolvedPath).getErrors().length > 0);
    if (!hasErrors) continue;

    importErrors.push(new CompileError(
      CompileErrorCode.IMPORTED_FILE_HAS_ERRORS,
      `Imported file '${node.importPath.value}' contains errors`,
      node.importPath,
    ));
  }

  if (importErrors.length === 0) return result;

  return new Report(
    result.getValue(),
    [...result.getErrors(), ...importErrors],
    result.getWarnings(),
    result.getInfos(),
  );
}

// Interpret all files. Returns raw MasterDatabase
export function interpretProject (this: Compiler): Report<MasterDatabase> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];
  const infos: CompileInfo[] = [];

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
    infos.push(...parseResult.getInfos());

    const bindResult = this.bindFile(file);
    errors.push(...bindResult.getErrors());
    warnings.push(...bindResult.getWarnings());
    infos.push(...bindResult.getInfos());

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
    infos.push(...result.getInfos());
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
  }, errors, warnings, infos);
}
