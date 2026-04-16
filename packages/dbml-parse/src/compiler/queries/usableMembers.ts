import type Compiler from '@/compiler';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
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
} from '@/core/types/symbol';

// This does not perform duplicate checks
export function usableMembers (this: Compiler, symbolOrFilepath: SchemaSymbol | Filepath): Report<{
  nonSchemaMembers: NodeSymbol[];
  schemaMembers: SchemaSymbol[];
  // reuses are transitive (re-exported to importers)
  reuses: {
    selective: UseSpecifierNode[];
    wildcard: { importPath: Filepath;
      node: WildcardNode; }[];
  };
  // uses are local only (not re-exported)
  uses: {
    selective: UseSpecifierNode[];
    wildcard: { importPath: Filepath;
      node: WildcardNode; }[];
  };
}> {
  const nonSchemaMembers: NodeSymbol[] = [];
  const childSchemas = new Map<string, SchemaSymbol>();

  const wildcardReuses: { importPath: Filepath;
    node: WildcardNode; }[] = [];
  const selectiveReuses: UseSpecifierNode[] = [];
  const wildcardUses: { importPath: Filepath;
    node: WildcardNode; }[] = [];
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
    const schemas = this.topLevelSchemaMembers(symbolOrFilepath) as SchemaSymbol[];
    schemaMembers.push(...schemas);
    // Also collect non-schema members from the public schema
    const publicSchema = schemas.find((s) => s.qualifiedName.join('.') === DEFAULT_SCHEMA_NAME);
    if (publicSchema) {
      const publicUsable = this.fileUsableMembers(publicSchema).getFiltered(UNHANDLED);
      if (publicUsable) {
        nonSchemaMembers.push(...publicUsable.nonSchemaMembers);
      }
    }
  } else {
    const symbol = symbolOrFilepath;
    for (const element of ast.body) {
    // Process element declaration
      if (!(element instanceof ElementDeclarationNode)) continue;
      const nestedSchemaName = shouldBelongToThisSchema(this, symbol, element);
      if (nestedSchemaName === false) continue;

      if (nestedSchemaName === true) {
      // Direct member of this schema
        const memberSymbol = this.nodeSymbol(element).getFiltered(UNHANDLED);
        if (!memberSymbol) continue;
        nonSchemaMembers.push(memberSymbol);
      } else {
      // Element belongs to a child schema - create it if not yet seen
        if (!childSchemas.has(nestedSchemaName)) {
          childSchemas.set(
            nestedSchemaName,
            this.symbolFactory.create(
              SchemaSymbol,
              {
                name: nestedSchemaName,
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

// Return if this node introduces a declaration belong to schemaSymbol
// - Return true if the declaration belongs directly to the schemaSymbol
// - Return false if the declaration doesn't belong to the schemaSymbol
// - Return a string for the directly nested schema name that the declaration belongs to
export function shouldBelongToThisSchema (compiler: Compiler, schemaSymbol: SchemaSymbol, element: ElementDeclarationNode | UseSpecifierNode): boolean | string {
  const qualifiedName = schemaSymbol.qualifiedName;
  let fullname: string[] | undefined;

  // For use specifier, alias is the real name existing in the scope
  if (element instanceof UseSpecifierNode) {
    const alias = compiler.nodeAlias(element).getFiltered(UNHANDLED);
    if (alias !== undefined) {
      fullname = [
        alias,
      ];
    } else {
      fullname = compiler.nodeFullname(element).getFiltered(UNHANDLED);
    }
  } else {
    fullname = compiler.nodeFullname(element).getFiltered(UNHANDLED);
  }
  if (!fullname) return false;

  // Elements with no name or no schema prefix belong to the default (public) schema
  // e.g. anonymous Refs, Notes, etc.
  const elementSchemaChain = !fullname || fullname.length <= 1
    ? [
        DEFAULT_SCHEMA_NAME,
      ]
    : fullname.slice(0, -1);

  // Must start with this schema's qualified name
  if (elementSchemaChain.length < qualifiedName.length) return false;
  if (!qualifiedName.every((seg, i) => seg === elementSchemaChain[i])) return false;

  if (elementSchemaChain.length === qualifiedName.length) {
    // Direct member of this schema
    return true;
  } else {
    // Element belongs to a child schema - create it if not yet seen
    return elementSchemaChain[qualifiedName.length];
  }
}
