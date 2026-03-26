import type Compiler from '../../../index';
import { Filepath } from '../../../projectLayout';
import { ExternalSymbol, NodeSymbol, NodeSymbolIdGenerator, SchemaSymbol, TableGroupSymbol } from '@/core/analyzer/validator/symbol/symbols';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode } from '@/core/parser/nodes';
import { destructureComplexVariable } from '@/core/utils';
import { registerSchemaStack } from '@/core/analyzer/validator/utils';
import SymbolFactory from '@/core/analyzer/validator/symbol/factory';
import { createNodeSymbolIndex, destructureIndex, SymbolKind } from '@/core/analyzer/validator/symbol/symbolIndex';
import SymbolTable from '@/core/analyzer/validator/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { validateFile } from './index';

function lookupSymbol (
  table: Readonly<SymbolTable>,
  path: { name: string; kind: SymbolKind }[],
): NodeSymbol | undefined {
  let current: Readonly<SymbolTable> = table;
  for (let i = 0; i < path.length; i++) {
    const id = createNodeSymbolIndex(path[i].name, path[i].kind);
    const symbol = current.get(id);
    if (!symbol) return undefined;
    if (i === path.length - 1) return symbol;
    if (!symbol.symbolTable) return undefined;
    current = symbol.symbolTable;
  }
  return undefined;
}

// Resolve all `use` declarations for a file. Clones the local table and returns the resolved copy.
export function resolveExternalDependencies (
  compiler: Compiler,
  currentFilepath: Filepath,
  local: { symbolTable: Readonly<SymbolTable>; symbolIdGenerator: NodeSymbolIdGenerator; nodeToSymbol: NodeToSymbolMap },
): Report<SymbolTable> {
  const externalFilepaths = compiler.localFileDependencies(currentFilepath);
  const ctx = {
    symbolFactory: new SymbolFactory(local.symbolIdGenerator, currentFilepath),
    clonedSchemas: new WeakSet<SchemaSymbol>(),
  };
  const resolvedTable = local.symbolTable.clone();
  const errors: CompileError[] = [];

  for (const [filepathKey, useNode] of externalFilepaths) {
    const externalFilepath = Filepath.from(filepathKey);
    const externalLocal = validateFile(compiler, externalFilepath);

    if (externalLocal.errors.length > 0) continue;

    const externalTable = externalLocal.symbolTable;

    if (!useNode.specifiers) {
      errors.push(...resolveWholeFileUse({ resolvedTable, externalTable, externalFilepath, ...ctx }));
    } else {
      errors.push(...resolveSelectiveUse({ resolvedTable, externalTable, externalFilepath, ...ctx }));
    }
  }

  return new Report(resolvedTable, errors);
}

function resolveWholeFileUse ({ resolvedTable, externalTable, externalFilepath, symbolFactory, clonedSchemas }: {
  resolvedTable: SymbolTable;
  externalTable: Readonly<SymbolTable>;
  externalFilepath: Filepath;
  symbolFactory: SymbolFactory;
  clonedSchemas: WeakSet<SchemaSymbol>;
}): CompileError[] {
  const placeholderErrors = replacePlaceholders(resolvedTable, externalTable, externalFilepath);
  return [...placeholderErrors, ...mergeSymbolTables({ target: resolvedTable, source: externalTable, symbolFactory, clonedSchemas })];
}

function resolveSelectiveUse ({ resolvedTable, externalTable, externalFilepath, symbolFactory, clonedSchemas }: {
  resolvedTable: SymbolTable;
  externalTable: Readonly<SymbolTable>;
  externalFilepath: Filepath;
  symbolFactory: SymbolFactory;
  clonedSchemas: WeakSet<SchemaSymbol>;
}): CompileError[] {
  const errors: CompileError[] = [];

  errors.push(...replacePlaceholders(resolvedTable, externalTable, externalFilepath));
  pullTableGroupMembers(resolvedTable, externalTable, symbolFactory);

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

    if (existing === undefined) {
      target.set(entryId, entrySymbol);
      continue;
    }

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

    if (existing === entrySymbol || existing.filepath.intern() === entrySymbol.filepath.intern()) {
      continue;
    }

    const entryInfo = destructureIndex(entryId).unwrap_or(undefined);
    const location = schemaPath ? ` in schema '${schemaPath}'` : '';
    errors.push(new CompileError(
      CompileErrorCode.DUPLICATE_NAME,
      `'${entryInfo?.name ?? entryId}'${location} conflicts with an imported definition`,
      entrySymbol.declaration!));
  }

  return errors;
}

function replacePlaceholders (
  table: SymbolTable,
  externalTable: Readonly<SymbolTable>,
  externalFilepath: Filepath,
): CompileError[] {
  const errors: CompileError[] = [];
  for (const [symbolId, symbol] of table.entries()) {
    if (symbol instanceof ExternalSymbol && symbol.externalFilepath.equals(externalFilepath)) {
      const realId = createNodeSymbolIndex(symbol.name, symbol.kind);
      const realSymbol = externalTable.get(realId);
      if (realSymbol) {
        table.set(symbolId, realSymbol);
      } else {
        table.delete(symbolId);
        errors.push(new CompileError(
          CompileErrorCode.BINDING_ERROR,
          `'${symbol.name}' (${symbol.kind}) not found in '${externalFilepath.absolute}'`,
          symbol.declaration!,
        ));
      }
    } else if (symbol instanceof SchemaSymbol) {
      const externalSchema = externalTable.get(symbolId);
      if (externalSchema instanceof SchemaSymbol) {
        errors.push(...replacePlaceholders(symbol.symbolTable, externalSchema.symbolTable, externalFilepath));
      }
    }
  }
  return errors;
}

function pullTableGroupMembers (
  resolvedTable: SymbolTable,
  externalTable: Readonly<SymbolTable>,
  symbolFactory: SymbolFactory,
): void {
  for (const [, symbol] of resolvedTable.entries()) {
    if (!(symbol instanceof TableGroupSymbol)) continue;
    if (!(symbol.declaration instanceof ElementDeclarationNode)) continue;
    if (!(symbol.declaration.body instanceof BlockExpressionNode)) continue;

    for (const field of symbol.declaration.body.body) {
      if (!(field instanceof FunctionApplicationNode) || !field.callee) continue;

      const fragments = destructureComplexVariable(field.callee).unwrap_or(undefined);
      if (!fragments || fragments.length === 0) continue;

      const tableName = fragments.pop()!;
      const schemaNames = fragments;

      const path = [
        ...schemaNames.map((name) => ({ name, kind: SymbolKind.Schema })),
        { name: tableName, kind: SymbolKind.Table },
      ];
      const tableSymbol = lookupSymbol(externalTable, path);
      if (!tableSymbol) continue;

      const targetTable = registerSchemaStack(schemaNames, resolvedTable, symbolFactory);
      const tableId = createNodeSymbolIndex(tableName, SymbolKind.Table);
      if (!targetTable.has(tableId)) {
        targetTable.set(tableId, tableSymbol);
      }
    }
  }
}
