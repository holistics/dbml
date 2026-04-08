import type Compiler from '@/compiler';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import { ElementDeclarationNode, UseDeclarationNode, type UseSpecifierNode, WildcardNode } from '@/core/parser/nodes';
import Report from '@/core/report';
import { type NodeSymbol, SchemaSymbol } from '@/core/types';
import { Filepath, resolveImportFilepath } from '@/core/types/filepath';

// This does not perform duplicate checks
export function usableMembers (this: Compiler, symbolOrFilepath: SchemaSymbol | Filepath): Report<{
  nonSchemaMembers: NodeSymbol[];
  schemaMembers: SchemaSymbol[];
  reuses: {
    selective: UseSpecifierNode[];
    wildcard: { importPath: Filepath; node: WildcardNode }[];
  };
}> {
  const nonSchemaMembers: NodeSymbol[] = [];
  const childSchemas = new Map<string, SchemaSymbol>();

  const wildcardReuses: { importPath: Filepath; node: WildcardNode }[] = [];
  const selectiveReuses: UseSpecifierNode[] = [];

  const filepath = symbolOrFilepath instanceof Filepath ? symbolOrFilepath : symbolOrFilepath.filepath;

  const { ast } = this.parse(filepath).getValue();

  for (const element of ast.body) {
    // Process reuse declaration
    if (element instanceof UseDeclarationNode && element.specifiers && element.importPath && element.isReuse) {
      const importPath = resolveImportFilepath(filepath, element.importPath.value);
      if (!importPath) continue;
      if (element.specifiers instanceof WildcardNode) {
        wildcardReuses.push({ importPath, node: element.specifiers });
        continue;
      }
      const specifiers = element.specifiers.specifiers;
      selectiveReuses.push(...specifiers);
    }
  }

  const schemaMembers: SchemaSymbol[] = [];

  if (symbolOrFilepath instanceof Filepath) {
    schemaMembers.push(...(this.topLevelSchemaMembers(symbolOrFilepath) as SchemaSymbol[]));
  } else {
    const symbol = symbolOrFilepath;
    for (const element of ast.body) {
    // Process element declaration
      if (!(element instanceof ElementDeclarationNode)) continue;
      const nestedSchemaName = shouldBelongToThisSchema(this, symbol, element);
      if (nestedSchemaName === false) continue;

      if (nestedSchemaName === true) {
      // Direct member of this schema
        const symbol = this.nodeSymbol(element).getFiltered(UNHANDLED);
        if (!symbol) continue;
        nonSchemaMembers.push(symbol);
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

  return Report.create({
    nonSchemaMembers,
    schemaMembers,
    reuses: {
      selective: selectiveReuses,
      wildcard: wildcardReuses,
    },
  });
}

// Return if this node introduces a declaration belong to schemaSymbol
// - Return true if the declaration belongs directly to the schemaSymbol
// - Return false if the declaration doesn't belong to the schemaSymbol
// - Return a string for the directly nested schema name that the declaration belongs to
export function shouldBelongToThisSchema (compiler: Compiler, schemaSymbol: SchemaSymbol, element: ElementDeclarationNode | UseSpecifierNode): boolean | string {
  const qualifiedName = schemaSymbol.qualifiedName;
  const fullname = compiler.fullname(element).getFiltered(UNHANDLED);
  if (!fullname) return false;

  // Elements with no name or no schema prefix belong to the default (public) schema
  // e.g. anonymous Refs, Notes, etc.
  const elementSchemaChain = !fullname || fullname.length <= 1 ? [DEFAULT_SCHEMA_NAME] : fullname.slice(0, -1);

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
