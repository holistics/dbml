import { uniqBy } from 'lodash-es';
import {
  ElementDeclarationNode, UseDeclarationNode, UseSpecifierListNode, WildcardNode,
} from '@/core/types/nodes';
import {
  SyntaxNode, UseSpecifierNode,
} from '@/core/types/nodes';
import {
  NodeSymbol, SchemaSymbol, SymbolKind, UseSymbol,
} from '@/core/types/symbol';
import type { GlobalModule } from '../types';
import {
  PASS_THROUGH, type PassThrough, UNHANDLED, DEFAULT_SCHEMA_NAME,
} from '@/constants';
import Report from '@/core/types/report';
import type Compiler from '@/compiler/index';
import {
  CompileError, CompileErrorCode,
} from '@/core/types/errors';
import { tableUtils } from '../table';
import { enumUtils } from '../enum';
import { tablePartialUtils } from '../tablePartial';
import { tableGroupUtils } from '../tableGroup';
import { shouldBelongToThisSchema } from '@/compiler/queries/usableMembers';
import { type Filepath } from '@/core/types/filepath';

export const schemaModule: GlobalModule = {
  symbolMembers (compiler: Compiler, symbol: NodeSymbol): Report<NodeSymbol[]> | Report<PassThrough> {
    if (!symbol.isKind(SymbolKind.Schema) || !(symbol instanceof SchemaSymbol)) return Report.create(PASS_THROUGH);
    const qualifiedName = symbol.qualifiedName;

    const usableMembers = compiler.fileUsableMembers(symbol).getFiltered(UNHANDLED);
    if (!usableMembers) return Report.create([]);

    const members = [...usableMembers.nonSchemaMembers];
    const childSchemas = new Map(usableMembers.schemaMembers.map((m) => [m.name, m]));

    // Process reuses (transitive - re-exported to importers)
    for (const specifier of usableMembers.reuses.selective) {
      const useSymbol = handleMemberSelectiveUses(compiler, symbol, specifier, childSchemas);
      if (useSymbol) members.push(useSymbol);
    }
    for (const {
      importPath, node,
    } of usableMembers.reuses.wildcard) {
      members.push(...handleMemberWildcardUses(compiler, symbol, importPath, node, childSchemas));
    }

    // Process uses (local only - not re-exported)
    for (const specifier of usableMembers.uses.selective) {
      const useSymbol = handleMemberSelectiveUses(compiler, symbol, specifier, childSchemas);
      if (useSymbol) members.push(useSymbol);
    }
    for (const {
      importPath, node,
    } of usableMembers.uses.wildcard) {
      members.push(...handleMemberWildcardUses(compiler, symbol, importPath, node, childSchemas));
    }

    members.push(...childSchemas.values());

    // Expand TableGroups to bring their tables into scope
    const membersWithExpansions: NodeSymbol[] = [...members];
    for (const member of members) {
      if (member.isKind(SymbolKind.TableGroup)) {
        membersWithExpansions.push(...expandTableGroup(compiler, member));
      }
    }

    // Filter out duplicate symbols (same real symbol), but keep distinct UseSymbols even if they
    // wrap the same underlying symbol (e.g. two aliases for the same table).
    const uniqueExpandedMembers = uniqBy(membersWithExpansions, (m) => (m instanceof UseSymbol ? m : m.originalSymbol));

    const errors: CompileError[] = [];

    // Duplicate checking and alias conflict detection (alias is only checked for `public`)
    const seen = new Map<string, NodeSymbol>();
    for (const member of uniqueExpandedMembers) {
      const isPublicSchema = symbol.isPublicSchema();

      const fullname = (member.declaration && compiler.nodeFullname(member.declaration).getFiltered(UNHANDLED)) || [];
      if (fullname.length > 1 && fullname[0] === DEFAULT_SCHEMA_NAME) {
        fullname.shift();
      }

      const canonicalName = isPublicSchema
        ? (fullname.length <= 1 ? compiler.symbolName(member) : undefined) // only include canonical name for public schema if the name is not qualified, or is qualified with DEFAULT_SCHEMA_NAME
        : compiler.symbolName(member);

      const alias = (
        isPublicSchema && member.declaration
      )
        ? compiler.nodeAlias(member.declaration).getFiltered(UNHANDLED)
        : undefined;

      const names = [...new Set([canonicalName, alias].filter(Boolean))];
      for (const name of names) {
        const key = `${member.kind}:${name}`;
        const existing = seen.get(key);
        if (existing) {
          // Report only on the duplicate (second) declaration
          const errorNode = (
            member.declaration && member.declaration instanceof ElementDeclarationNode
            && member.declaration.name
          )
            ? member.declaration.name
            : member.declaration;
          if (errorNode) {
            errors.push(getDuplicateSchemaMemberError(member.kind, name!, qualifiedName.join('.'), errorNode));
          }
        } else {
          seen.set(key, member);
        }
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
    default:
      return new CompileError(CompileErrorCode.DUPLICATE_NAME, `Duplicate ${kind} '${name}' in schema '${schemaLabel}'`, errorNode);
  }
}

// members utils
function handleMemberSelectiveUses (compiler: Compiler, symbol: SchemaSymbol, specifier: UseSpecifierNode, childSchemas: Map<string, SchemaSymbol>): NodeSymbol | undefined {
  const nestedSchemaName = shouldBelongToThisSchema(compiler, symbol, specifier);
  if (nestedSchemaName === false) return undefined;
  if (nestedSchemaName === true) {
    const usedSymbol = compiler.nodeSymbol(specifier).getFiltered(UNHANDLED);
    if (!usedSymbol) return undefined;
    return usedSymbol;
  }
  if (!childSchemas.has(nestedSchemaName)) {
    childSchemas.set(
      nestedSchemaName,
      compiler.symbolFactory.create(
        SchemaSymbol,
        {
          name: nestedSchemaName,
          parent: symbol as SchemaSymbol,
        },
        symbol.filepath,
      ),
    );
  }
  return undefined;
}

function handleMemberWildcardUses (compiler: Compiler, symbol: SchemaSymbol, importPath: Filepath, wildcardNode: WildcardNode, childSchemas: Map<string, SchemaSymbol>, visited: Set<Filepath> = new Set()): NodeSymbol[] {
  if (visited.has(importPath)) return [];
  visited.add(importPath);

  const externalSchemaSymbol = findSchemaSymbolInFilepath(compiler, importPath, symbol.qualifiedName);
  if (!externalSchemaSymbol) return [];

  const usableMembers = compiler.fileUsableMembers(externalSchemaSymbol).getFiltered(UNHANDLED);
  if (!usableMembers) return [];
  const members = usableMembers.nonSchemaMembers.map((m) => compiler.symbolFactory.create(UseSymbol, {
    kind: m.kind,
    declaration: m.declaration,
    usedSymbol: m,
    useSpecifierDeclaration: wildcardNode,
  }, symbol.filepath));

  for (const schemaMember of usableMembers.schemaMembers) {
    if (!childSchemas.has(schemaMember.name)) {
      childSchemas.set(
        schemaMember.name,
        compiler.symbolFactory.create(
          SchemaSymbol,
          { name: schemaMember.name },
          symbol.filepath,
        ),
      );
    }
  }

  const {
    reuses: {
      selective,
      wildcard,
    },
  } = usableMembers;

  for (const s of selective) {
    const externalSymbol = handleMemberSelectiveUses(compiler, symbol, s, childSchemas);
    if (externalSymbol) members.push(externalSymbol);
  }

  for (const { importPath: externalFilepath } of wildcard) {
    members.push(...handleMemberWildcardUses(compiler, symbol, externalFilepath, wildcardNode, childSchemas, visited));
  }

  return members;
}

function findSchemaSymbolInFilepath (compiler: Compiler, filepath: Filepath, schemaFullname: string[]): SchemaSymbol | undefined {
  if (schemaFullname.length === 0) return undefined;

  const usableSymbols = compiler.fileUsableMembers(filepath).getFiltered(UNHANDLED);
  if (!usableSymbols) return undefined;

  let { schemaMembers } = usableSymbols;
  let currentSchema: SchemaSymbol | undefined;

  const fullname = [...schemaFullname];
  while (fullname.length > 0) {
    const currentSchemaName = fullname.shift();
    currentSchema = schemaMembers.find((member) => member.name === currentSchemaName);
    if (!currentSchema) return undefined;
    const currentUsableSymbols = compiler.fileUsableMembers(currentSchema).getValue();
    ({ schemaMembers } = currentUsableSymbols);
  }

  return currentSchema;
}

function expandTableGroup (compiler: Compiler, tableGroupSymbol: NodeSymbol): NodeSymbol[] {
  if (!tableGroupSymbol.isKind(SymbolKind.TableGroup)) return [];

  const originalTableGroup = tableGroupSymbol.originalSymbol;
  const membersReport = compiler.symbolMembers(originalTableGroup);
  if (membersReport.hasValue(UNHANDLED)) return [];
  const members = membersReport.getValue();

  const extraSymbols: NodeSymbol[] = [];
  for (const field of members) {
    if (field.isKind(SymbolKind.TableGroupField) && field.declaration) {
      const originalTable = compiler.nodeReferee(field.declaration).getFiltered(UNHANDLED);
      if (originalTable && originalTable.isKind(SymbolKind.Table)) {
        let useSpecifierDeclaration: UseSpecifierNode | WildcardNode | undefined;
        if (tableGroupSymbol instanceof UseSymbol) {
          useSpecifierDeclaration = tableGroupSymbol.useSpecifierDeclaration;
        }

        extraSymbols.push(compiler.symbolFactory.create(UseSymbol, {
          kind: SymbolKind.Table,
          declaration: originalTable.declaration,
          usedSymbol: originalTable,
          useSpecifierDeclaration,
        }, tableGroupSymbol.filepath));
      }
    }
  }

  return extraSymbols;
}
