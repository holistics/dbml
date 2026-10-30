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

  // Check if any errors originate from imported files and highlight the import path
  const errors = result.getErrors();
  if (errors.length === 0) return result;

  // Build a map from imported file path -> import path token
  const importTokenByFile = new Map<string, NonNullable<UseDeclarationNode['importPath']>>();
  for (const node of ast.body) {
    if (!(node instanceof UseDeclarationNode) || !node.importPath) continue;
    const resolvedPath = this.layout.resolveFileSpecifier(filepath, node.importPath.value);
    if (!resolvedPath || importTokenByFile.has(resolvedPath.absolute)) continue;
    importTokenByFile.set(resolvedPath.absolute, node.importPath);
  }

  // Build a reverse map: any reachable file -> which direct import it came from
  const fileToImport = new Map<string, string>();
  for (const importFile of importTokenByFile.keys()) {
    fileToImport.set(importFile, importFile);
    for (const reachable of this.reachableFiles(Filepath.from(importFile))) {
      if (!fileToImport.has(reachable.absolute)) {
        fileToImport.set(reachable.absolute, importFile);
      }
    }
  }

  // Find which imports have errors
  const importsWithErrors = new Set<string>();
  for (const error of errors) {
    const errorFile = error.filepath.absolute;
    if (errorFile === filepath.absolute) continue;
    const owningImport = fileToImport.get(errorFile);
    if (owningImport) {
      importsWithErrors.add(owningImport);
    }
  }

  if (importsWithErrors.size === 0) return result;

  const importErrors: CompileError[] = [];
  for (const file of importsWithErrors) {
    const token = importTokenByFile.get(file)!;
    importErrors.push(new CompileError(
      CompileErrorCode.IMPORTED_FILE_HAS_ERRORS,
      `Imported file '${token.value}' contains errors`,
      token,
    ));
  }

  return new Report(
    result.getValue(),
    [...errors, ...importErrors],
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
