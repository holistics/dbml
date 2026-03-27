import type Compiler from '../../../index';
import { Filepath } from '../../../projectLayout';
import { ExternalSymbol, NodeSymbol, NodeSymbolIdGenerator, SchemaSymbol, TableGroupSymbol } from '@/core/analyzer/symbol/symbols';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode } from '@/core/parser/nodes';
import { destructureComplexVariable } from '@/core/analyzer/utils';
import { registerSchemaStack } from '@/core/analyzer/validator/utils';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { createNodeSymbolIndex, destructureIndex, SymbolKind } from '@/core/analyzer/symbol/symbolIndex';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { validateFile } from './index';
import { NodeToSymbolMap } from '@/core/analyzer/analyzer';

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

// Resolve all `use` declarations for a file by mutating the local symbol table in place.
export function resolveExternalDependencies (
  compiler: Compiler,
  currentFilepath: Filepath,
  local: {
    symbolTable: SymbolTable;
    symbolIdGenerator: NodeSymbolIdGenerator;
    nodeToSymbol: NodeToSymbolMap;
  },
): Report<SymbolTable> {
  const externalFilepaths = compiler.localFileDependencies(currentFilepath);
  const symbolFactory = new SymbolFactory(local.symbolIdGenerator, currentFilepath);
  const errors: CompileError[] = [];

  for (const filepathKey of externalFilepaths) {
    const externalFilepath = Filepath.from(filepathKey);
    const externalReport = validateFile(compiler, externalFilepath);

    if (externalReport.getErrors().length > 0) continue;

    const externalTable = externalReport.getValue().symbolTable;

    if (hasPlaceholdersFor(local.symbolTable, externalFilepath)) {
      errors.push(...resolveSelectiveUse({ target: local.symbolTable, externalTable, externalFilepath, symbolFactory }));
    } else {
      errors.push(...resolveWholeFileUse({ target: local.symbolTable, externalTable, externalFilepath, symbolFactory }));
    }
  }

  return new Report(local.symbolTable, errors);
}

function resolveWholeFileUse ({ target, externalTable, externalFilepath, symbolFactory }: {
  target: SymbolTable;
  externalTable: SymbolTable;
  externalFilepath: Filepath;
  symbolFactory: SymbolFactory;
}): CompileError[] {
  const placeholderErrors = replacePlaceholders(target, externalTable, externalFilepath);
  return [...placeholderErrors, ...mergeSymbolTables({ target, source: externalTable, symbolFactory })];
}

function resolveSelectiveUse ({ target, externalTable, externalFilepath, symbolFactory }: {
  target: SymbolTable;
  externalTable: SymbolTable;
  externalFilepath: Filepath;
  symbolFactory: SymbolFactory;
}): CompileError[] {
  const errors: CompileError[] = [];

  errors.push(...replacePlaceholders(target, externalTable, externalFilepath));
  pullTableGroupMembers(target, externalTable, symbolFactory);

  for (const [symbolId, symbol] of target.entries()) {
    if (!(symbol instanceof SchemaSymbol)) continue;
    if (!symbol.externalFilepaths.some((fp) => fp.equals(externalFilepath))) continue;

    const externalSchema = externalTable.get(symbolId);
    if (!(externalSchema instanceof SchemaSymbol)) continue;

    const name = destructureIndex(symbolId).unwrap_or(undefined)?.name ?? symbolId;
    errors.push(...mergeSymbolTables({ target: symbol.symbolTable, source: externalSchema.symbolTable, schemaPath: name, symbolFactory }));
  }

  return errors;
}

function mergeSymbolTables ({ target, source, schemaPath, symbolFactory }: {
  target: SymbolTable;
  source: SymbolTable;
  schemaPath?: string;
  symbolFactory: SymbolFactory;
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
      const nestedPath = schemaPath ? `${schemaPath}.${nestedName}` : nestedName;
      errors.push(...mergeSymbolTables({ target: existing.symbolTable, source: entrySymbol.symbolTable, schemaPath: nestedPath, symbolFactory }));
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

function hasPlaceholdersFor (table: SymbolTable, externalFilepath: Filepath): boolean {
  for (const [, symbol] of table.entries()) {
    if (symbol instanceof ExternalSymbol && symbol.externalFilepath.equals(externalFilepath)) return true;
    if (symbol instanceof SchemaSymbol && hasPlaceholdersFor(symbol.symbolTable, externalFilepath)) return true;
  }
  return false;
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
