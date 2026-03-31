import type Compiler from '@/compiler';
import { Filepath, FilepathId } from '@/compiler/projectLayout';
import {
  AnalysisResult,
  NodeToSymbolMap,
  NodeToRefereeMap,
  SymbolToReferencesMap,
} from '@/core/analyzer/analyzer';
import { InternedMap } from '@/core/internable';
import Binder from '@/core/analyzer/binder/binder';
import SymbolFactory from '@/core/analyzer/symbol/factory';
import {
  NodeSymbol,
  SchemaSymbol,
  TableGroupSymbol,
} from '@/core/analyzer/symbol/symbols';
import {
  createNodeSymbolIndex,
  destructureIndex,
  SymbolKind,
} from '@/core/analyzer/symbol/symbolIndex';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import {
  BlockExpressionNode,
  ElementDeclarationNode,
  FunctionApplicationNode,
} from '@/core/parser/nodes';
import { destructureComplexVariable } from '@/core/analyzer/utils';
import { registerSchemaStack } from '@/core/analyzer/validator/utils';
import Report from '@/core/report';
import { CompileError, CompileErrorCode, CompileWarning } from '@/core/errors';
import { ElementKind } from '@/core/analyzer/types';
import { getElementKind } from '@/core/analyzer/utils';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { validateFile, type SelectiveUseInfo, type WildcardUseInfo } from './utils';
import { collectTransitiveDependencies } from '../../utils';

export type { SelectiveUseInfo, WildcardUseInfo } from './utils';

export function bindProject (this: Compiler): Report<AnalysisResult> {
  const errors: CompileError[] = [];
  const warnings: CompileWarning[] = [];

  // Collect all files via transitive deps from each entry, skipping already-visited
  const visited = new Set<FilepathId>();
  const allFiles: Filepath[] = [];

  for (const entry of this.layout().getEntryPoints()) {
    for (const file of collectTransitiveDependencies(this, entry)) {
      if (visited.has(file.intern())) continue;
      visited.add(file.intern());
      allFiles.push(file);
    }
  }

  // Validate all files
  const validatedFiles = new Map(allFiles.map((file) => {
    const { ast } = this.parseFile(file).getValue();
    const report = validateFile(this, file);
    const { publicSchemaSymbol, nodeToSymbol, wildcardUses, selectiveUses } = report.getValue();
    errors.push(...report.getErrors());
    warnings.push(...report.getWarnings());
    return [
      file.intern(), {
        filepath: file,
        ast,
        publicSchemaSymbol,
        nodeToSymbol,
        wildcardUses,
        selectiveUses,
      },
    ];
  }));

  // Merge into a single symbol table and resolve imports
  const nodeToSymbol: NodeToSymbolMap = new InternedMap();
  const nodeToReferee: NodeToRefereeMap = new InternedMap();
  const symbolToReferences: SymbolToReferencesMap = new InternedMap();

  for (const {
    filepath,
    publicSchemaSymbol,
    selectiveUses,
    wildcardUses,
    nodeToSymbol: currentNodeToSymbol,
  } of validatedFiles.values()) {
    const symbolFactory = new SymbolFactory(this.symbolIdGenerator, filepath);

    errors.push(...resolveExternalDependencies(
      validatedFiles,
      { symbolTable: publicSchemaSymbol.symbolTable, selectiveUses, wildcardUses },
      symbolFactory,
    ));

    nodeToSymbol.merge(currentNodeToSymbol);
  }

  // Round 1: resolve partial injections across all files
  for (const { ast, filepath } of validatedFiles.values()) {
    const binder = new Binder(
      { ast },
      { nodeToSymbol, nodeToReferee, symbolToReferences },
      new SymbolFactory(this.symbolIdGenerator, filepath),
    );
    errors.push(...binder.resolvePartialInjections());
  }

  // Round 2: bind references
  for (const { ast, filepath } of validatedFiles.values()) {
    const binder = new Binder(
      { ast },
      { nodeToSymbol, nodeToReferee, symbolToReferences },
      new SymbolFactory(this.symbolIdGenerator, filepath),
    );
    const report = binder.resolve();
    errors.push(...report.getErrors());
    warnings.push(...report.getWarnings());
  }

  // Validate project-wide constraints
  const allProjects = [...validatedFiles.values()].flatMap(({ ast }) =>
    ast.declarations.filter((e) => getElementKind(e).unwrap_or(undefined) === ElementKind.Project),
  );
  if (allProjects.length > 1) {
    for (const project of allProjects) {
      errors.push(new CompileError(
        CompileErrorCode.PROJECT_REDEFINED,
        'Only one Project element can exist across all files',
        project,
      ));
    }
  }

  return new Report(
    { nodeToSymbol, nodeToReferee, symbolToReferences },
    errors,
    warnings,
  );
}

// Build the public view of a file's symbol table by resolving reexports.
export function getPublicSymbolTable (
  validatedFiles: Map<FilepathId, { publicSchemaSymbol: SchemaSymbol; selectiveUses: SelectiveUseInfo[]; wildcardUses: WildcardUseInfo[] }>,
  filepath: Filepath,
  symbolFactory: SymbolFactory,
  cache: Map<FilepathId, SymbolTable | undefined> = new Map(),
  visited: Set<FilepathId> = new Set(),
): SymbolTable | undefined {
  const fpId = filepath.intern();
  if (cache.has(fpId)) return cache.get(fpId);
  if (visited.has(fpId)) return undefined;
  visited.add(fpId);

  const validated = validatedFiles.get(fpId);
  if (!validated) { cache.set(fpId, undefined); return undefined; }

  const table = validated.publicSchemaSymbol.symbolTable;

  for (const use of validated.selectiveUses) {
    if (!use.reexport) continue;
    const sourceTable = getPublicSymbolTable(validatedFiles, use.filepath, symbolFactory, cache, visited);
    if (!sourceTable) continue;
    const resolved = resolveSelectiveImport(use, sourceTable);
    if (resolved) {
      const targetTable = registerSchemaStack([...use.schemaPath], table, symbolFactory);
      targetTable.set(createNodeSymbolIndex(use.localName, use.kind), resolved);
    }
  }

  for (const use of validated.wildcardUses) {
    if (!use.reexport) continue;
    const sourceTable = getPublicSymbolTable(validatedFiles, use.filepath, symbolFactory, cache, visited);
    if (!sourceTable) continue;
    pullFromExternalSymbolTables({ localTable: table, externalTable: sourceTable, symbolFactory });
  }

  visited.delete(fpId);
  cache.set(fpId, table);
  return table;
}

// Look up a selective import in the source table and return the resolved symbol.
function resolveSelectiveImport (
  use: SelectiveUseInfo,
  sourceTable: SymbolTable,
): NodeSymbol | undefined {
  // Navigate to the schema if schema-qualified (skip default schema since it's implicit)
  let lookupTable: SymbolTable = sourceTable;
  for (const schema of use.schemaPath) {
    if (schema === DEFAULT_SCHEMA_NAME) continue;
    const schemaId = createNodeSymbolIndex(schema, SymbolKind.Schema);
    const schemaSymbol = lookupTable.get(schemaId);
    if (!(schemaSymbol instanceof SchemaSymbol)) return undefined;
    lookupTable = schemaSymbol.symbolTable;
  }

  const realId = createNodeSymbolIndex(use.name, use.kind);
  return lookupTable.get(realId) ?? undefined;
}

// Resolve all use and reuse declarations for a file.
function resolveExternalDependencies (
  validatedFiles: Map<FilepathId, {
    publicSchemaSymbol: SchemaSymbol;
    selectiveUses: SelectiveUseInfo[];
    wildcardUses: WildcardUseInfo[];
  }>,
  local: {
    symbolTable: SymbolTable;
    selectiveUses: SelectiveUseInfo[];
    wildcardUses: WildcardUseInfo[];
  },
  symbolFactory: SymbolFactory,
): CompileError[] {
  const errors: CompileError[] = [];

  // Resolve selective imports
  for (const use of local.selectiveUses) {
    const externalTable = getPublicSymbolTable(validatedFiles, use.filepath, symbolFactory);
    const resolved = externalTable ? resolveSelectiveImport(use, externalTable) : undefined;
    if (!resolved) {
      errors.push(new CompileError(
        CompileErrorCode.BINDING_ERROR,
        `'${use.name}' (${use.kind}) not found in '${use.filepath.absolute}'`,
        use.declaration,
      ));
      continue;
    }

    // Aliased imports register at top level; non-aliased use the schema path
    const hasAlias = use.localName !== use.name;
    const targetTable = hasAlias
      ? local.symbolTable
      : registerSchemaStack([...use.schemaPath], local.symbolTable, symbolFactory);
    const symbolId = createNodeSymbolIndex(use.localName, use.kind);

    const existing = targetTable.get(symbolId);
    if (existing && existing.intern() !== resolved.intern()) {
      if (existing instanceof SchemaSymbol && resolved instanceof SchemaSymbol) {
        mergeSchemas(existing, resolved);
      } else if (existing.filepath.intern() !== resolved.filepath.intern()) {
        errors.push(new CompileError(
          CompileErrorCode.DUPLICATE_NAME,
          `'${use.localName}' is already defined`,
          use.declaration,
        ));
      }
      continue;
    }

    targetTable.set(symbolId, resolved);

    // For schema-qualified imports, also pull remaining schema contents
    if (use.schemaPath.length > 0 && !hasAlias && externalTable) {
      let externalSchemaTable: SymbolTable = externalTable;
      let localSchemaTable: SymbolTable = local.symbolTable;
      for (const schema of use.schemaPath) {
        const schemaId = createNodeSymbolIndex(schema, SymbolKind.Schema);
        const extSchema = externalSchemaTable.get(schemaId);
        const localSchema = localSchemaTable.get(schemaId);
        if (!(extSchema instanceof SchemaSymbol) || !(localSchema instanceof SchemaSymbol)) break;
        errors.push(...pullFromExternalSymbolTables({
          localTable: localSchema.symbolTable,
          externalTable: extSchema.symbolTable,
          schemaPath: schema,
          symbolFactory,
        }));
        externalSchemaTable = extSchema.symbolTable;
        localSchemaTable = localSchema.symbolTable;
      }
    }

    // Pull table group members if importing a table group
    if (resolved instanceof TableGroupSymbol && externalTable) {
      pullTableGroupMembers(local.symbolTable, externalTable, symbolFactory);
    }
  }

  // Resolve wildcard imports
  for (const use of local.wildcardUses) {
    const externalTable = getPublicSymbolTable(validatedFiles, use.filepath, symbolFactory);
    if (!externalTable) continue;

    errors.push(...pullFromExternalSymbolTables({
      localTable: local.symbolTable,
      externalTable,
      symbolFactory,
    }));
  }

  return errors;
}

function mergeSchemas (target: SchemaSymbol, source: SchemaSymbol): void {
  for (const [entryId, entrySymbol] of source.symbolTable.entries()) {
    if (!target.symbolTable.has(entryId)) {
      target.symbolTable.set(entryId, entrySymbol);
    }
  }
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
    if (entrySymbol.isExternal(entrySymbol.filepath)) continue;

    const existing = localTable.get(entryId);

    if (existing === undefined) {
      localTable.set(entryId, entrySymbol);
      continue;
    }

    if (
      existing instanceof SchemaSymbol
      && entrySymbol instanceof SchemaSymbol
    ) {
      const nestedName =
        destructureIndex(entryId).unwrap_or(undefined)?.name ?? entryId;
      const nestedPath = schemaPath
        ? `${schemaPath}.${nestedName}`
        : nestedName;
      errors.push(
        ...pullFromExternalSymbolTables({
          localTable: existing.symbolTable,
          externalTable: entrySymbol.symbolTable,
          schemaPath: nestedPath,
          symbolFactory,
        }),
      );
      continue;
    }

    if (
      existing === entrySymbol
      || existing.filepath.intern() === entrySymbol.filepath.intern()
    )
      continue;

    const entryInfo = destructureIndex(entryId).unwrap_or(undefined);
    const location = schemaPath ? ` in schema '${schemaPath}'` : '';
    errors.push(
      new CompileError(
        CompileErrorCode.DUPLICATE_NAME,
        `'${entryInfo?.name ?? entryId}'${location} conflicts with an imported definition`,
        entrySymbol.declaration!,
      ),
    );
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
      if (!(field instanceof FunctionApplicationNode) || !field.callee)
        continue;

      const fragments = destructureComplexVariable(field.callee).unwrap_or(
        undefined,
      );
      if (!fragments || fragments.length === 0) continue;

      const tableName = fragments.pop()!;
      const schemaNames = fragments;

      const path = [
        ...schemaNames.map((name) => ({ name, kind: SymbolKind.Schema })),
        { name: tableName, kind: SymbolKind.Table },
      ];
      const tableSymbol = lookupSymbol(externalTable, path);
      if (!tableSymbol) continue;

      const targetTable = registerSchemaStack(
        schemaNames,
        resolvedTable,
        symbolFactory,
      );
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
