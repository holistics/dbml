import type Compiler from '@/compiler';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import {
  useUtils,
} from '@/core/global_modules/use';
import {
  Filepath, resolveImportFilepath,
} from '@/core/types/filepath';
import {
  UNHANDLED,
} from '@/core/types/module';
import {
  ElementDeclarationNode, UseDeclarationNode, UseSpecifierNode, WildcardNode,
} from '@/core/types/nodes';
import Report from '@/core/types/report';
import {
  type NodeSymbol, SchemaSymbol,
  AliasSymbol,
} from '@/core/types/symbol';

// This does not perform duplicate checks
export function usableMembers (this: Compiler, symbolOrFilepath: SchemaSymbol | Filepath): Report<{
  nonSchemaMembers: NodeSymbol[];
  schemaMembers: SchemaSymbol[];
  // reuses are transitive (re-exported to importers)
  reuses: {
    selective: UseSpecifierNode[];
    wildcard: {
      importPath: Filepath;
      node: WildcardNode;
    }[];
  };
  // uses are local only (not re-exported)
  uses: {
    selective: UseSpecifierNode[];
    wildcard: {
      importPath: Filepath;
      node: WildcardNode;
    }[];
  };
}> {
  const nonSchemaMembers: NodeSymbol[] = [];
  const childSchemas = new Map<string, SchemaSymbol>();

  const wildcardReuses: {
    importPath: Filepath;
    node: WildcardNode;
  }[] = [];
  const selectiveReuses: UseSpecifierNode[] = [];
  const wildcardUses: {
    importPath: Filepath;
    node: WildcardNode;
  }[] = [];
  const selectiveUses: UseSpecifierNode[] = [];

  const filepath = symbolOrFilepath instanceof Filepath ? symbolOrFilepath : symbolOrFilepath.filepath;

  const parseResult = this.parseFile(filepath);
  const {
    ast,
  } = parseResult.getValue();

  for (const element of ast.body) {
    if (!(element instanceof UseDeclarationNode) || !element.specifiers || !element.importPath) continue;
    const importPath = resolveImportFilepath(filepath, element.importPath.value);
    if (!importPath) continue;

    if (element.isReuse) {
      if (element.specifiers instanceof WildcardNode) {
        wildcardReuses.push({
          importPath,
          node: element.specifiers,
        });
      } else {
        selectiveReuses.push(...element.specifiers.specifiers);
      }
    } else {
      if (element.specifiers instanceof WildcardNode) {
        wildcardUses.push({
          importPath,
          node: element.specifiers,
        });
      } else {
        selectiveUses.push(...element.specifiers.specifiers);
      }
    }
  }

  const schemaMembers: SchemaSymbol[] = [];

  if (symbolOrFilepath instanceof Filepath) {
    // Collect top-level schemas defined in this file (not from uses/reuses)
    const fileSchemas = new Map<string, SchemaSymbol>([
      [DEFAULT_SCHEMA_NAME, this.symbolFactory.create(SchemaSymbol, { name: DEFAULT_SCHEMA_NAME }, symbolOrFilepath)],
    ]);
    for (const element of ast.declarations) {
      const fullname = this.nodeFullname(element).getFiltered(UNHANDLED) || [];
      const schemaName = fullname.length <= 1 ? DEFAULT_SCHEMA_NAME : fullname[0];
      if (!fileSchemas.has(schemaName)) {
        fileSchemas.set(schemaName, this.symbolFactory.create(SchemaSymbol, { name: schemaName }, symbolOrFilepath));
      }
    }
    schemaMembers.push(...fileSchemas.values());
    // Also collect non-schema members from the public schema
    const publicSchema = schemaMembers.find((s) => s.isPublicSchema());
    if (publicSchema) {
      const publicUsable = this.usableMembers(publicSchema).getFiltered(UNHANDLED);
      if (publicUsable) {
        nonSchemaMembers.push(...publicUsable.nonSchemaMembers);
      }
    }
  } else {
    const symbol = symbolOrFilepath;
    for (const element of ast.body) {
    // Process element declaration
      if (!(element instanceof ElementDeclarationNode)) continue;
      const membership = schemaMembership(this, symbol, element);
      const alias = this.nodeAlias(element).getFiltered(UNHANDLED);
      const elementSymbol = this.nodeSymbol(element).getFiltered(UNHANDLED);
      if (alias !== undefined && symbol.isPublicSchema() && elementSymbol) {
        nonSchemaMembers.push(this.symbolFactory.create(
          AliasSymbol,
          {
            kind: elementSymbol.kind,
            declaration: element,
            aliasedSymbol: elementSymbol,
            name: alias,
          },
          symbol.filepath,
        ));
      }
      if (membership.kind === 'none') continue;

      if (membership.kind === 'direct') {
        const memberSymbol = this.nodeSymbol(element).getFiltered(UNHANDLED);
        if (!memberSymbol) continue;
        nonSchemaMembers.push(memberSymbol);
      } else {
        if (!childSchemas.has(membership.schemaName)) {
          childSchemas.set(
            membership.schemaName,
            this.symbolFactory.create(
              SchemaSymbol,
              {
                name: membership.schemaName,
                parent: symbol as SchemaSymbol,
              },
              symbol.filepath,
            ),
          );
        }
      }
    }
    schemaMembers.push(...childSchemas.values());
  }

  return new Report(
    {
      nonSchemaMembers,
      schemaMembers,
      reuses: {
        selective: selectiveReuses,
        wildcard: wildcardReuses,
      },
      uses: {
        selective: selectiveUses,
        wildcard: wildcardUses,
      },
    },
    parseResult.getErrors(),
    parseResult.getWarnings(),
  );
}

// Whether a declaration belongs to a given schema.
// 'direct': element is a direct member (e.g. `Table users` in `public` schema)
// 'child': element belongs to a nested child schema (e.g. `Table auth.users` -> child 'auth')
// 'none': element doesn't belong to this schema at all
export type SchemaMembership =
  | { kind: 'direct' }
  | { kind: 'child'; schemaName: string }
  | { kind: 'none' };

export function schemaMembership (compiler: Compiler, schema: SchemaSymbol, element: ElementDeclarationNode | UseSpecifierNode): SchemaMembership {
  const qualifiedName = schema.qualifiedName;
  let fullname: string[] | undefined;

  if (element instanceof UseSpecifierNode) {
    fullname = useUtils.visibleName(compiler, element);
  } else {
    fullname = compiler.nodeFullname(element).getFiltered(UNHANDLED);
  }
  if (!fullname) return { kind: 'none' };

  // Elements with no name or no schema prefix belong to the default (public) schema
  const elementSchemaChain = fullname.length <= 1
    ? [DEFAULT_SCHEMA_NAME]
    : fullname.slice(0, -1);

  if (elementSchemaChain.length < qualifiedName.length) return { kind: 'none' };
  if (!qualifiedName.every((segment, i) => segment === elementSchemaChain[i])) return { kind: 'none' };

  if (elementSchemaChain.length === qualifiedName.length) {
    return { kind: 'direct' };
  }
  return { kind: 'child', schemaName: elementSchemaChain[qualifiedName.length] };
}

