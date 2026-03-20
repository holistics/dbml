import type Compiler from '../../index';
import type { NodeToSymbolMap } from '@/core/types';
import { Filepath } from '../../projectLayout';
import { ExternalSymbol, SchemaSymbol } from '@/core/validator/symbol/symbols';
import { createNodeSymbolIndex, destructureIndex, SymbolKind } from '@/core/validator/symbol/symbolIndex';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import Report from '@/core/report';
import type { CompileError, CompileWarning } from '@/core/errors';

export type FileResolvedSymbolIndex = {
  readonly symbolTable: Readonly<SymbolTable>;
  readonly nodeToSymbol: NodeToSymbolMap;
};

// Global query: resolve external symbols by looking up referenced files' local symbol tables.
// Creates a new symbol table (copy of local) with ExternalSymbols replaced by real symbols.
export function resolvedSymbolTable (this: Compiler, filepath: Filepath): Report<FileResolvedSymbolIndex> {
  const local = this.validateFile(filepath);
  const errors: CompileError[] = [...local.errors];
  const warnings: CompileWarning[] = [...local.warnings];

  if (errors.length > 0) {
    return new Report(
      { symbolTable: new SymbolTable(), nodeToSymbol: local.nodeToSymbol },
      errors,
      warnings,
    );
  }

  const { symbolTable: localTable, nodeToSymbol, externalFilepaths } = local;

  // Copy the local symbol table so we don't mutate the cached local result
  const resolvedTable = cloneSymbolTable(localTable);

  for (const [filepathKey] of externalFilepaths) {
    const externalFilepath = Filepath.from(filepathKey);
    const externalLocal = this.validateFile(externalFilepath);

    if (externalLocal.errors.length > 0) {
      continue;
    }

    resolveExternalSymbols(resolvedTable, externalLocal.symbolTable, externalFilepath);
    mergeExternalSchemas(resolvedTable, externalLocal.symbolTable, externalFilepath);
  }

  return new Report({ symbolTable: resolvedTable, nodeToSymbol }, errors, warnings);
}

function cloneSymbolTable (source: Readonly<SymbolTable>): SymbolTable {
  const clone = new SymbolTable();
  for (const [id, symbol] of source.entries()) {
    clone.set(id, symbol);
  }
  return clone;
}

// Merge external schema contents into local schemas that have been marked for merging
function mergeExternalSchemas (
  resolvedTable: SymbolTable,
  externalTable: Readonly<SymbolTable>,
  externalFilepath: Filepath,
): void {
  for (const [symbolId, symbol] of resolvedTable.entries()) {
    if (!(symbol instanceof SchemaSymbol)) continue;
    if (!symbol.externalFilepaths.some((fp) => fp.intern() === externalFilepath.intern())) continue;

    const info = destructureIndex(symbolId).unwrap_or(undefined);
    if (!info || info.kind !== SymbolKind.Schema) continue;

    // Find the matching schema in the external file's symbol table
    const externalSchema = externalTable.get(symbolId);
    if (!(externalSchema instanceof SchemaSymbol)) continue;

    // Merge external schema's symbol table entries into the local schema
    for (const [entryId, entrySymbol] of externalSchema.symbolTable.entries()) {
      if (!symbol.symbolTable.has(entryId)) {
        symbol.symbolTable.set(entryId, entrySymbol);
      }
    }
  }
}

function resolveExternalSymbols (
  resolvedTable: SymbolTable,
  externalTable: Readonly<SymbolTable>,
  externalFilepath: Filepath,
): void {
  for (const [symbolId, symbol] of resolvedTable.entries()) {
    if (!(symbol instanceof ExternalSymbol)) continue;
    if (symbol.externalFilepath.intern() !== externalFilepath.intern()) continue;

    const resolvedSymbolId = createNodeSymbolIndex(symbol.name, symbol.kind);
    const resolvedSymbol = externalTable.get(resolvedSymbolId);

    if (resolvedSymbol) {
      resolvedTable.set(symbolId, resolvedSymbol);
    }
  }
}
