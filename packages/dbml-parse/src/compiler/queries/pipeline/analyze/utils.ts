import type Compiler from '../../../index';
import { Filepath } from '../../../projectLayout';
import { ExternalSymbol, NodeSymbol, SchemaSymbol, TableGroupSymbol } from '@/core/analyzer/symbol/symbols';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode } from '@/core/parser/nodes';
import { destructureComplexVariable } from '@/core/analyzer/utils';
import { registerSchemaStack } from '@/core/analyzer/validator/utils';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import { createNodeSymbolIndex, destructureIndex, SymbolKind } from '@/core/analyzer/symbol/symbolIndex';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import Report from '@/core/report';
import { CompileError, CompileErrorCode } from '@/core/errors';
import { validateFile } from './index';
import { NodeToSymbolMap } from '@/core/analyzer/analyzer';

const DBML_EXT = '.dbml';

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
  ast: ProgramNode,
  local: {
    symbolTable: SymbolTable;
    nodeToSymbol: NodeToSymbolMap;
  },
): Report<SymbolTable> {
  const symbolFactory = new SymbolFactory(compiler.symbolIdGenerator, ast.filepath);
  const errors: CompileError[] = [];

  for (const node of ast.useDeclarations) {
    if (!node.path || !Filepath.isRelative(node.path.value)) continue;
    const resolved = Filepath.resolve(ast.filepath.dirname, node.path.value);
    const externalFilepath = resolved.absolute.endsWith(DBML_EXT) ? resolved : Filepath.from(resolved.absolute + DBML_EXT);

    const externalReport = validateFile(compiler, externalFilepath);
    if (externalReport.getErrors().length > 0) continue;

    const externalTable = externalReport.getValue().symbolTable;

    if (node.specifiers) {
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
  return [...placeholderErrors, ...pullFromExternalSymbolTables({ localTable: target, externalTable: externalTable, symbolFactory })];
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
    errors.push(...pullFromExternalSymbolTables({ localTable: symbol.symbolTable, externalTable: externalSchema.symbolTable, schemaPath: name, symbolFactory }));
  }

  return errors;
}

function pullFromExternalSymbolTables ({
  localTable,
  externalTable,
  schemaPath,
  symbolFactory,
}: {
  localTable: SymbolTable;
  externalTable: SymbolTable;
  schemaPath?: string;
  symbolFactory: SymbolFactory;
}): CompileError[] {
  const errors: CompileError[] = [];

  for (const [entryId, entrySymbol] of externalTable.entries()) {
    // We do not support transitive imports
    if (entrySymbol instanceof ExternalSymbol) continue;

    // We do not support transitive imports
    if (entrySymbol.isExternal(entrySymbol.filepath)) continue;

    const existing = localTable.get(entryId);

    if (existing === undefined) {
      localTable.set(entryId, entrySymbol);
      continue;
    }

    if (existing instanceof SchemaSymbol && entrySymbol instanceof SchemaSymbol) {
      const nestedName = destructureIndex(entryId).unwrap_or(undefined)?.name ?? entryId;
      const nestedPath = schemaPath ? `${schemaPath}.${nestedName}` : nestedName;
      errors.push(...pullFromExternalSymbolTables({ localTable: existing.symbolTable, externalTable: entrySymbol.symbolTable, schemaPath: nestedPath, symbolFactory }));
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
