import type Compiler from '../../../index';
import { Filepath } from '../../../projectLayout';
import { ExternalSymbol, SchemaSymbol } from '@/core/validator/symbol/symbols';
import SymbolFactory from '@/core/validator/symbol/factory';
import { createNodeSymbolIndex, destructureIndex } from '@/core/validator/symbol/symbolIndex';
import SymbolTable from '@/core/validator/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';

// Resolve all `use` declarations for a file. Clones the local table and returns the resolved copy.
export function resolveExternalDependencies (
  compiler: Compiler,
  currentFilepath: Filepath,
): Report<SymbolTable> {
  const { symbolTable: localTable, symbolIdGenerator, externalFilepaths } = compiler.validateFile(currentFilepath);
  const ctx = {
    symbolFactory: new SymbolFactory(symbolIdGenerator, currentFilepath),
    clonedSchemas: new WeakSet<SchemaSymbol>(),
  };
  const resolvedTable = localTable.clone();
  const errors: CompileError[] = [];

  for (const [filepathKey, useNode] of externalFilepaths) {
    const externalFilepath = Filepath.from(filepathKey);
    const externalLocal = compiler.validateFile(externalFilepath);

    if (externalLocal.errors.length > 0) continue;

    if (!useNode.specifiers) {
      errors.push(...resolveWholeFileUse({ resolvedTable, externalTable: externalLocal.symbolTable, ...ctx }));
    } else {
      errors.push(...resolveSelectiveUse({ resolvedTable, externalTable: externalLocal.symbolTable, externalFilepath, ...ctx }));
    }
  }

  return new Report(resolvedTable, errors);
}

// `use './b.dbml'`: merge all symbols from the external file (except its own imports).
function resolveWholeFileUse ({ resolvedTable, externalTable, symbolFactory, clonedSchemas }: {
  resolvedTable: SymbolTable;
  externalTable: Readonly<SymbolTable>;
  symbolFactory: SymbolFactory;
  clonedSchemas: WeakSet<SchemaSymbol>;
}): CompileError[] {
  return mergeSymbolTables({ target: resolvedTable, source: externalTable, symbolFactory, clonedSchemas });
}

// `use { table T } from './b.dbml'`:
//  - Replace ExternalSymbol placeholders with the real symbols.
//  - For `use { schema S }`, merge the external schema's contents into the local one.
function resolveSelectiveUse ({ resolvedTable, externalTable, externalFilepath, symbolFactory, clonedSchemas }: {
  resolvedTable: SymbolTable;
  externalTable: Readonly<SymbolTable>;
  externalFilepath: Filepath;
  symbolFactory: SymbolFactory;
  clonedSchemas: WeakSet<SchemaSymbol>;
}): CompileError[] {
  const errors: CompileError[] = [];

  // Replace placeholders (recurses into schema sub-tables)
  replacePlaceholders(resolvedTable, externalTable, externalFilepath);

  // Merge imported schemas
  for (const [symbolId, symbol] of resolvedTable.entries()) {
    if (!(symbol instanceof SchemaSymbol)) continue;
    if (!symbol.externalFilepaths.some((fp) => fp.equals(externalFilepath))) continue;

    const externalSchema = externalTable.get(symbolId);
    if (!(externalSchema instanceof SchemaSymbol)) continue;

    const name = destructureIndex(symbolId).unwrap_or(undefined)?.name ?? symbolId;
    let schema = symbol;
    if (!clonedSchemas.has(symbol)) {
      schema = symbolFactory.create(SchemaSymbol, { symbolTable: symbol.symbolTable.clone() });
      schema.externalFilepaths = [...symbol.externalFilepaths];
      resolvedTable.set(symbolId, schema);
      clonedSchemas.add(schema);
    }
    errors.push(...mergeSymbolTables({ target: schema.symbolTable, source: externalSchema.symbolTable, schemaPath: name, symbolFactory, clonedSchemas }));
  }

  return errors;
}

// Recursively merge source into target, skipping ExternalSymbols.
//  - New entries: inserted directly.
//  - Both schemas: clone on write, recurse.
//  - Other duplicates: report error.
function mergeSymbolTables ({ target, source, schemaPath, symbolFactory, clonedSchemas }: {
  target: SymbolTable;
  source: Readonly<SymbolTable>;
  schemaPath?: string;
  symbolFactory: SymbolFactory;
  clonedSchemas: WeakSet<SchemaSymbol>;
}): CompileError[] {
  const errors: CompileError[] = [];

  for (const [entryId, entrySymbol] of source.entries()) {
    if (entrySymbol instanceof ExternalSymbol) continue;

    const existing = target.get(entryId);

    // New entry - insert
    if (existing === undefined) {
      target.set(entryId, entrySymbol);
      continue;
    }

    // Both schemas - clone on write, recurse
    if (existing instanceof SchemaSymbol && entrySymbol instanceof SchemaSymbol) {
      const nestedName = destructureIndex(entryId).unwrap_or(undefined)?.name ?? entryId;
      let nested = existing;
      if (!clonedSchemas.has(existing)) {
        nested = symbolFactory.create(SchemaSymbol, { symbolTable: existing.symbolTable.clone() });
        nested.externalFilepaths = [...existing.externalFilepaths];
        target.set(entryId, nested);
        clonedSchemas.add(nested);
      }
      const nestedPath = schemaPath ? `${schemaPath}.${nestedName}` : nestedName;
      errors.push(...mergeSymbolTables({ target: nested.symbolTable, source: entrySymbol.symbolTable, schemaPath: nestedPath, symbolFactory, clonedSchemas }));
      continue;
    }

    // Duplicate - error
    if (existing !== entrySymbol) {
      const entryInfo = destructureIndex(entryId).unwrap_or(undefined);
      const location = schemaPath ? ` in schema '${schemaPath}'` : '';
      errors.push(new CompileError(
        CompileErrorCode.DUPLICATE_NAME,
        `'${entryInfo?.name ?? entryId}'${location} conflicts with an imported definition`,
        entrySymbol.declaration!,
      ));
    }
  }

  return errors;
}

// Replace ExternalSymbol placeholders with real symbols from the external file.
// Recurses into SchemaSymbol sub-tables since ExternalSymbols can be nested
// (e.g. `use { table S.T } from './b.dbml'` places the placeholder inside schema S).
function replacePlaceholders (
  table: SymbolTable,
  externalTable: Readonly<SymbolTable>,
  externalFilepath: Filepath,
): void {
  for (const [symbolId, symbol] of table.entries()) {
    if (symbol instanceof ExternalSymbol && symbol.externalFilepath.equals(externalFilepath)) {
      const realId = createNodeSymbolIndex(symbol.name, symbol.kind);
      const realSymbol = externalTable.get(realId);
      if (realSymbol) table.set(symbolId, realSymbol);
    } else if (symbol instanceof SchemaSymbol) {
      const externalSchema = externalTable.get(symbolId);
      if (externalSchema instanceof SchemaSymbol) {
        replacePlaceholders(symbol.symbolTable, externalSchema.symbolTable, externalFilepath);
      }
    }
  }
}
