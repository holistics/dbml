import type Compiler from '@/compiler/index';
import {
  schemaMembership,
} from '@/compiler/queries/files/usableMembers';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import {
  type Filepath,
} from '@/core/types/filepath';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED,
} from '@/core/types/module';
import {
  ElementDeclarationNode, FunctionApplicationNode, WildcardNode,
} from '@/core/types/nodes';
import {
  SyntaxNode, UseSpecifierNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  NodeSymbol, SchemaSymbol, SymbolKind, UseSymbol,
} from '@/core/types/symbol';
import {
  destructureComplexVariable,
} from '@/core/utils/expression';
import {
  enumUtils,
} from '../enum';
import {
  tableUtils,
} from '../table';
import {
  tableGroupUtils,
} from '../tableGroup';
import {
  tablePartialUtils,
} from '../tablePartial';
import type {
  GlobalModule,
} from '../types';
import {
  diagramViewUtils,
} from '../diagramView';

export const schemaModule: GlobalModule = {
  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Schema) || !(symbol instanceof SchemaSymbol)) return Report.create(PASS_THROUGH);
    const qualifiedName = symbol.qualifiedName;

    // 1. Collect raw declarations (uses usableMembers to avoid resolution cycles)
    const usableMembers = compiler.usableMembers(symbol).getFiltered(UNHANDLED);
    if (!usableMembers) return Report.create([]);

    // Direct (non-imported) members declared in this schema
    const members = [
      ...usableMembers.nonSchemaMembers,
    ];
    // Child schemas (e.g. `Table auth.users` creates child `auth`), shared across import processing
    const childSchemas = new Map(usableMembers.schemaMembers.map((m) => [
      m.name,
      m,
    ]));

    const errors: CompileError[] = [];

    // 2. Process imports (reuses first so dedup in 5. keeps reuse variants)

    // 2a. Reuse imports (transitive, re-exported to downstream importers)
    for (const specifier of usableMembers.reuses.selective) {
      const useSymbolResult = handleMemberSelectiveUses(compiler, symbol, specifier, childSchemas);
      errors.push(...useSymbolResult.getErrors());
      const useSymbol = useSymbolResult.getFiltered(UNHANDLED);
      if (useSymbol) members.push(useSymbol);
    }
    for (const {
      importPath, node,
    } of usableMembers.reuses.wildcard) {
      members.push(...handleMemberWildcardUses(compiler, symbol, importPath, node, childSchemas));
    }

    // 2b. Use imports (local only, not re-exported)
    for (const specifier of usableMembers.uses.selective) {
      const useSymbolResult = handleMemberSelectiveUses(compiler, symbol, specifier, childSchemas);
      errors.push(...useSymbolResult.getErrors());
      const useSymbol = useSymbolResult.getFiltered(UNHANDLED);
      if (useSymbol) members.push(useSymbol);
    }
    for (const {
      importPath, node,
    } of usableMembers.uses.wildcard) {
      members.push(...handleMemberWildcardUses(compiler, symbol, importPath, node, childSchemas));
    }

    // 3. Add child schemas discovered during import processing
    members.push(...childSchemas.values());

    // 4. Expand TableGroups (inject member tables into scope)
    const membersWithExpansions: NodeSymbol[] = [
      ...members,
    ];
    for (const member of members) {
      if (member.isKind(SymbolKind.TableGroup)) {
        membersWithExpansions.push(...expandTableGroup(compiler, member));
      }
    }

    // 5. Dedup by (originalSymbol, localName); reuse wins (added first in 2a.)
    const dedupKeys = new Set<string>();
    const uniqueExpandedMembers = membersWithExpansions.filter((m) => {
      const key = `${m.originalSymbol.intern()}:${m.name ?? ''}`;
      if (dedupKeys.has(key)) return false;
      dedupKeys.add(key);
      return true;
    });

    // 6. Duplicate checking
    const seen = new Map<string, NodeSymbol>();
    for (const member of uniqueExpandedMembers) {
      const key = `${member.kind}:${member.name}`;
      const existing = seen.get(key);
      if (existing) {
        // Error points at the use specifier in the current file, not the original declaration
        const errorNode = member instanceof UseSymbol
          ? (member.useSpecifierDeclaration ?? member.declaration)
          : (member.declaration instanceof ElementDeclarationNode && member.declaration.name
              ? member.declaration.name
              : member.declaration);
        if (errorNode && member.name !== undefined) {
          errors.push(getDuplicateSchemaMemberError(member.kind, member.name, qualifiedName.join('.'), errorNode));
        }
      } else {
        seen.set(key, member);
      }
    }

    return new Report(uniqueExpandedMembers, errors);
  },
};

function getDuplicateSchemaMemberError (kind: SymbolKind, name: string, schemaLabel: string, errorNode: SyntaxNode): CompileError {
  switch (kind) {
    case SymbolKind.Table:
      return tableUtils.getDuplicateError(name, schemaLabel, errorNode);
    case SymbolKind.Enum:
      return enumUtils.getDuplicateError(name, schemaLabel, errorNode);
    case SymbolKind.TablePartial:
      return tablePartialUtils.getDuplicateError(name, schemaLabel, errorNode);
    case SymbolKind.TableGroup:
      return tableGroupUtils.getDuplicateError(name, schemaLabel, errorNode);
    case SymbolKind.DiagramView:
      return diagramViewUtils.getDuplicateError(name, schemaLabel, errorNode);
    default:
      return new CompileError(CompileErrorCode.DUPLICATE_NAME, `Duplicate ${kind} '${name}' in schema '${schemaLabel}'`, errorNode);
  }
}

// Resolve a selective use/reuse specifier (e.g. `use { table auth.users as u }`)
// Returns UseSymbol if direct member, or registers a child schema if nested
function handleMemberSelectiveUses (compiler: Compiler, symbol: SchemaSymbol, specifier: UseSpecifierNode, childSchemas: Map<string, SchemaSymbol>): Report<NodeSymbol | undefined> {
  const membership = schemaMembership(compiler, symbol, specifier);
  if (membership.kind === 'none') return Report.create(undefined);
  if (membership.kind === 'direct') {
    const usedSymbol = compiler.nodeSymbol(specifier);
    if (usedSymbol.hasValue(UNHANDLED)) return Report.create(undefined);
    return usedSymbol;
  }
  if (!childSchemas.has(membership.schemaName)) {
    childSchemas.set(
      membership.schemaName,
      compiler.symbolFactory.create(
        SchemaSymbol,
        {
          name: membership.schemaName,
          parent: symbol as SchemaSymbol,
        },
        symbol.filepath,
      ),
    );
  }
  return Report.create(undefined);
}

// Resolve a wildcard use/reuse (e.g. `use * from './base.dbml'`)
// Wraps importable members as UseSymbols, registers child schemas, recursively follows reuse chains.
// `visited` guards against circular reuse paths.
function handleMemberWildcardUses (
  compiler: Compiler,
  symbol: SchemaSymbol,
  importPath: Filepath,
  wildcardNode: WildcardNode,
  childSchemas: Map<string, SchemaSymbol>,
  visited: Set<Filepath> = new Set(),
): NodeSymbol[] {
  if (visited.has(importPath)) return [];
  visited.add(importPath);

  const externalSchemaSymbol = findSchemaSymbolInFilepath(compiler, importPath, symbol.qualifiedName);
  if (!externalSchemaSymbol) return [];

  const usableMembers = compiler.usableMembers(externalSchemaSymbol).getFiltered(UNHANDLED);
  if (!usableMembers) return [];

  // Wrap importable direct members as UseSymbols owned by the current file
  const members: NodeSymbol[] = usableMembers.nonSchemaMembers
    .filter((m) => m.canBeImported)
    .map((m) => compiler.symbolFactory.create(UseSymbol, {
      kind: m.kind,
      declaration: m.declaration,
      usedSymbol: m,
      useSpecifierDeclaration: wildcardNode,
      name: m.name,
    }, symbol.filepath));

  // Register child schemas from the external file
  for (const schemaMember of usableMembers.schemaMembers) {
    if (!childSchemas.has(schemaMember.name)) {
      childSchemas.set(
        schemaMember.name,
        compiler.symbolFactory.create(
          SchemaSymbol,
          {
            name: schemaMember.name,
          },
          symbol.filepath,
        ),
      );
    }
  }

  // Follow the external file's reuse chains (uses are local-only, not followed)
  const {
    reuses: {
      selective,
      wildcard,
    },
  } = usableMembers;

  for (const s of selective) {
    const externalSymbol = handleMemberSelectiveUses(compiler, symbol, s, childSchemas).getFiltered(UNHANDLED);
    if (externalSymbol) members.push(externalSymbol);
  }

  for (const {
    importPath: externalFilepath,
  } of wildcard) {
    members.push(...handleMemberWildcardUses(compiler, symbol, externalFilepath, wildcardNode, childSchemas, visited));
  }

  return members;
}

// Find a SchemaSymbol by qualified name in an external file
// Uses usableMembers (raw) to avoid cycles (called from handleMemberWildcardUses)
function findSchemaSymbolInFilepath (compiler: Compiler, filepath: Filepath, schemaFullname: string[]): SchemaSymbol | undefined {
  if (schemaFullname.length === 0) return undefined;

  const usableSymbols = compiler.usableMembers(filepath).getFiltered(UNHANDLED);
  if (!usableSymbols) return undefined;

  let {
    schemaMembers,
  } = usableSymbols;
  let currentSchema: SchemaSymbol | undefined;

  const fullname = [
    ...schemaFullname,
  ];
  while (fullname.length > 0) {
    const currentSchemaName = fullname.shift();
    currentSchema = schemaMembers.find((member) => member.name === currentSchemaName);
    if (!currentSchema) return undefined;
    const currentUsableSymbols = compiler.usableMembers(currentSchema).getValue();
    ({
      schemaMembers,
    } = currentUsableSymbols);
  }

  return currentSchema;
}

// Inject a TableGroup's member tables into scope
function expandTableGroup (compiler: Compiler, tableGroupSymbol: NodeSymbol): NodeSymbol[] {
  if (!tableGroupSymbol.isKind(SymbolKind.TableGroup)) return [];

  const originalTableGroup = tableGroupSymbol.originalSymbol;
  const members = compiler.symbolMembers(originalTableGroup).getFiltered(UNHANDLED);
  if (!members) return [];

  const extraSymbols: NodeSymbol[] = [];
  for (const field of members) {
    if (!field.isKind(SymbolKind.TableGroupField) || !field.declaration) continue;

    const callee = (field.declaration as FunctionApplicationNode).callee;
    if (!callee) continue;

    const nameParts = destructureComplexVariable(callee);
    if (!nameParts || nameParts.length === 0) continue;

    const sourceFilepath = field.declaration.filepath;
    const originalTable = lookupTableInFile(compiler, sourceFilepath, nameParts);
    if (!originalTable) continue;

    if (tableGroupSymbol instanceof UseSymbol) {
      // Imported TableGroup: wrap table as UseSymbol to bring into scope
      extraSymbols.push(compiler.symbolFactory.create(UseSymbol, {
        kind: SymbolKind.Table,
        declaration: originalTable.declaration,
        usedSymbol: originalTable,
        useSpecifierDeclaration: undefined,
        name: originalTable.name,
      }, tableGroupSymbol.filepath));
    }
    // Local TableGroup: member tables are already declared in scope, no injection needed.
  }

  return extraSymbols;
}

// Look up a table by qualified name from a file's raw declarations.
// Uses usableMembers to avoid cycles (called from expandTableGroup).
function lookupTableInFile (compiler: Compiler, filepath: Filepath, nameParts: string[]): NodeSymbol | undefined {
  if (nameParts.length === 1) {
    const usable = compiler.usableMembers(filepath).getFiltered(UNHANDLED);
    if (!usable) return undefined;
    return usable.nonSchemaMembers.find((m) => m.isKind(SymbolKind.Table) && m.name === nameParts[0]);
  }

  const [
    schemaName,
    tableName,
  ] = [
    nameParts[0],
    nameParts[nameParts.length - 1],
  ];
  const usable = compiler.usableMembers(filepath).getFiltered(UNHANDLED);
  if (!usable) return undefined;
  const schema = usable.schemaMembers.find((s) => s.name === schemaName);
  if (!schema) return undefined;
  const schemaUsable = compiler.usableMembers(schema).getFiltered(UNHANDLED);
  if (!schemaUsable) return undefined;
  return schemaUsable.nonSchemaMembers.find((m) => m.isKind(SymbolKind.Table) && m.name === tableName);
}
