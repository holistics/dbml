import type Compiler from '../../index';
import { Filepath, FilepathId } from '../../projectLayout';
import { AnalysisResult, NodeToSymbolMap, NodeToRefereeMap, SymbolToReferencesMap } from '@/core/binder/analyzer';
import { InternedMap } from '@/core/internable';
import Validator from '@/core/binder/validator/validator';
import Binder from '@/core/binder/binder/binder';
import SymbolFactory from '@/core/binder/symbol/factory';
import { ExternalSymbol, NodeSymbol, SchemaSymbol, TableGroupSymbol } from '@/core/binder/symbol/symbols';
import { createNodeSymbolIndex, destructureIndex, SymbolKind } from '@/core/binder/symbol/symbolIndex';
import SymbolTable from '@/core/binder/symbol/symbolTable';
import { BlockExpressionNode, ElementDeclarationNode, FunctionApplicationNode, ProgramNode } from '@/core/parser/nodes';
import { destructureComplexVariable } from '@/core/binder/utils';
import { registerSchemaStack } from '@/core/binder/validator/utils';
import Report from '@/core/report';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/errors';
import { ElementKind } from '@/core/binder/types';
import { getElementKind } from '@/core/binder/utils';
import { DBML_EXT } from '@/compiler/constants';

export function collectTransitiveDependencies (compiler: Compiler, entrypoint: Filepath): Filepath[] {
  const visited = new Set<FilepathId>();
  const order: Filepath[] = [];

  const collect = (fp: Filepath) => {
    const id = fp.intern();
    if (visited.has(id)) return;
    visited.add(id);
    order.push(fp);

    for (const depId of compiler.localFileDependencies(fp)) {
      collect(Filepath.from(depId));
    }
  };
  collect(entrypoint);
  return order;
}

// Resolve all `use` declarations for a file by mutating the local symbol table in place.
function resolveExternalDependencies (
  compiler: Compiler,
  ast: ProgramNode,
  local: { symbolTable: SymbolTable; nodeToSymbol: NodeToSymbolMap },
): Report<SymbolTable> {
  const symbolFactory = new SymbolFactory(compiler.symbolIdGenerator, ast.filepath);
  const errors: CompileError[] = [];

  for (const node of ast.useDeclarations) {
    if (!node.path || !Filepath.isRelative(node.path.value)) continue;
    const resolved = Filepath.resolve(ast.filepath.dirname, node.path.value);
    const externalFilepath = resolved.absolute.endsWith(DBML_EXT) ? resolved : Filepath.from(resolved.absolute + DBML_EXT);

    const externalParseReport = compiler.parseFile(externalFilepath);
    if (externalParseReport.getErrors().length > 0) continue;

    const externalAst = externalParseReport.getValue().ast;
    const externalRootSymbol = local.nodeToSymbol.get(externalAst);
    if (!(externalRootSymbol instanceof SchemaSymbol)) continue;

    const externalTable = externalRootSymbol.symbolTable;

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
  return [...placeholderErrors, ...pullFromExternalSymbolTables({ localTable: target, externalTable, symbolFactory })];
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
  localTable, externalTable, schemaPath, symbolFactory,
}: {
  localTable: SymbolTable;
  externalTable: SymbolTable;
  schemaPath?: string;
  symbolFactory: SymbolFactory;
}): CompileError[] {
  const errors: CompileError[] = [];

  for (const [entryId, entrySymbol] of externalTable.entries()) {
    if (entrySymbol instanceof ExternalSymbol) continue;
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

    if (existing === entrySymbol || existing.filepath.intern() === entrySymbol.filepath.intern()) continue;

    const entryInfo = destructureIndex(entryId).unwrap_or(undefined);
    const location = schemaPath ? ` in schema '${schemaPath}'` : '';
    errors.push(new CompileError(
      CompileErrorCode.DUPLICATE_NAME,
      `'${entryInfo?.name ?? entryId}'${location} conflicts with an imported definition`,
      entrySymbol.declaration!,
    ));
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

// Validate all files in the project with a shared symbol map.
// Enforces at most one Project element across all files.
export function validateProject (this: Compiler): Report<{ nodeToSymbol: NodeToSymbolMap }> {
  const files = this.layout().listAllFiles();
  const nodeToSymbol: NodeToSymbolMap = new InternedMap();

  const validateReport = Report.concat(
    ...files.map((file) =>
      this.parseFile(file).chain(({ ast }) => {
        const symbolFactory = new SymbolFactory(this.symbolIdGenerator, file);
        return new Validator({ ast }, { nodeToSymbol }, symbolFactory).validate();
      }),
    ),
  );

  const allProjects = files.flatMap((file) => {
    const { ast } = this.parseFile(file).getValue();
    return ast.declarations.filter((e) => getElementKind(e).unwrap_or(undefined) === ElementKind.Project);
  });
  const projectErrors: CompileError[] = [];
  if (allProjects.length > 1) {
    allProjects.forEach((project) => projectErrors.push(
      new CompileError(CompileErrorCode.PROJECT_REDEFINED, 'Only one Project element can exist across all files', project),
    ));
  }

  return Report.concat<unknown>(validateReport, new Report(undefined, projectErrors))
    .map(() => ({ nodeToSymbol }));
}

// Validate, resolve external symbols, and bind references for all files in the project.
export function bindProject (this: Compiler): Report<AnalysisResult> {
  const files = this.layout().listAllFiles();
  const validateReport = this.validateProject();
  const { nodeToSymbol } = validateReport.getValue();

  const resolveReport = Report.concat(
    ...files.map((file) => {
      const { ast } = this.parseFile(file).getValue();
      const rootSymbol = nodeToSymbol.get(ast) as SchemaSymbol;
      return resolveExternalDependencies(this, ast, { symbolTable: rootSymbol.symbolTable, nodeToSymbol });
    }),
  );

  const nodeToReferee: NodeToRefereeMap = new InternedMap();
  const symbolToReferences: SymbolToReferencesMap = new InternedMap();

  const partialInjectionReport = Report.concat(
    ...files.map((file) => {
      const { ast } = this.parseFile(file).getValue();
      const symbolFactory = new SymbolFactory(this.symbolIdGenerator, file);
      const binder = new Binder({ ast }, { nodeToSymbol, nodeToReferee, symbolToReferences }, symbolFactory);
      return new Report(undefined, binder.resolvePartialInjections({ ast, nodeToSymbol, nodeToReferee, symbolToReferences }));
    }),
  );

  const bindReport = Report.concat(
    ...files.map((file) => {
      const { ast } = this.parseFile(file).getValue();
      const symbolFactory = new SymbolFactory(this.symbolIdGenerator, file);
      const binder = new Binder({ ast }, { nodeToSymbol, nodeToReferee, symbolToReferences }, symbolFactory);
      return binder.resolve();
    }),
  );

  return Report.concat<unknown>(validateReport, resolveReport, partialInjectionReport, bindReport)
    .map(() => ({ nodeToSymbol, nodeToReferee, symbolToReferences }));
}

// Validate, resolve external symbols, and bind references for a single file.
// symbolToReferences only covers this file's dependencies, not files that import from it.
// Use compiler.nodeReferences() for project-wide lookup.
export function bindFile (this: Compiler, filepath: Filepath): Report<AnalysisResult> {
  const { ast } = this.parseFile(filepath).getValue();
  const validationReport = this.validateFile(filepath);
  // Deep clone publicSchemaSymbol so resolveExternalDependencies doesn't mutate the cached validateFile result
  const clonedRoot = validationReport.getValue().publicSchemaSymbol.deepClone();
  const nodeToSymbol = clonedRoot.getNodeSymbolMapping();
  const symbolFactory = new SymbolFactory(this.symbolIdGenerator, filepath);

  const errors: CompileError[] = [...validationReport.getErrors()];
  const warnings: CompileWarning[] = [...validationReport.getWarnings()];

  const resolveReport = resolveExternalDependencies(this, ast, { symbolTable: clonedRoot.symbolTable, nodeToSymbol });
  errors.push(...resolveReport.getErrors());

  const nodeToReferee: NodeToRefereeMap = new InternedMap();
  const symbolToReferences: SymbolToReferencesMap = new InternedMap();
  const bindingReport = new Binder({ ast }, { nodeToSymbol, nodeToReferee, symbolToReferences }, symbolFactory).resolve();
  errors.push(...bindingReport.getErrors());
  warnings.push(...bindingReport.getWarnings());

  return new Report({ nodeToSymbol, nodeToReferee, symbolToReferences }, errors, warnings);
}
