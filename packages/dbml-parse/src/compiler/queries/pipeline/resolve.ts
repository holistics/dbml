import type Compiler from '../../index';
import type { NodeToSymbolMap } from '@/core/types';
import { Filepath } from '../../projectLayout';
import { ExternalSymbol } from '@/core/validator/symbol/symbols';
import { createNodeSymbolIndex } from '@/core/validator/symbol/symbolIndex';
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
  const local = this.localSymbolTable(filepath);
  const errors: CompileError[] = [...local.getErrors()];
  const warnings: CompileWarning[] = [...local.getWarnings()];

  if (errors.length > 0) {
    return new Report(
      { symbolTable: new SymbolTable(), nodeToSymbol: local.getValue().nodeToSymbol },
      errors,
      warnings,
    );
  }

  const { symbolTable: localTable, nodeToSymbol, externalFilepaths } = local.getValue();

  // Copy the local symbol table so we don't mutate the cached local result
  const resolvedTable = cloneSymbolTable(localTable);

  for (const [filepathKey] of externalFilepaths) {
    const externalFilepath = Filepath.from(filepathKey);
    const externalLocal = this.localSymbolTable(externalFilepath);

    if (externalLocal.getErrors().length > 0) {
      errors.push(...externalLocal.getErrors());
      warnings.push(...externalLocal.getWarnings());
      continue;
    }

    const externalTable = externalLocal.getValue().symbolTable;
    resolveExternalSymbols(resolvedTable, externalTable, externalFilepath.absolute);
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

function resolveExternalSymbols (
  resolvedTable: SymbolTable,
  externalTable: Readonly<SymbolTable>,
  externalFilepath: string,
): void {
  for (const [symbolId, symbol] of resolvedTable.entries()) {
    if (!(symbol instanceof ExternalSymbol)) continue;
    if (symbol.externalFilepath !== externalFilepath) continue;

    const resolvedSymbolId = createNodeSymbolIndex(symbol.name, symbol.kind);
    const resolvedSymbol = externalTable.get(resolvedSymbolId);

    if (resolvedSymbol) {
      resolvedTable.set(symbolId, resolvedSymbol);
    }
  }
}
