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
  type NodeSymbol, SchemaSymbol, ProgramSymbol,
  AliasSymbol,
  SymbolKind,
} from '@/core/types/symbol';

type UsableResult = {
  nonSchemaMembers: NodeSymbol[];
  schemaMembers: SchemaSymbol[];
  reuses: {
    selective: UseSpecifierNode[];
    wildcard: {
      importPath: Filepath;
      node: WildcardNode;
    }[];
  };
  uses: {
    selective: UseSpecifierNode[];
    wildcard: {
      importPath: Filepath;
      node: WildcardNode;
    }[];
  };
};

// This does not perform duplicate checks
export function usableMembers (this: Compiler, symbolOrFilepath: SchemaSymbol | ProgramSymbol | Filepath): Report<UsableResult> {
  // Filepath -> delegate to ProgramSymbol for canonical schema ownership
  if (symbolOrFilepath instanceof Filepath) {
    const {
      ast,
    } = this.parseFile(symbolOrFilepath).getValue();
    const programSymbol = this.nodeSymbol(ast).getFiltered(UNHANDLED);
    return this.usableMembers(programSymbol as ProgramSymbol);
  }

  const filepath = symbolOrFilepath.filepath;
  const imports = collectImports(this, filepath);

  const {
    nonSchemaMembers, schemaMembers,
  } = symbolOrFilepath instanceof ProgramSymbol
    ? usableMembersForProgram(this, symbolOrFilepath, imports)
    : usableMembersForSchema(this, symbolOrFilepath, imports);

  return new Report(
    {
      nonSchemaMembers,
      schemaMembers,
      reuses: {
        selective: imports.selectiveReuses,
        wildcard: imports.wildcardReuses,
      },
      uses: {
        selective: imports.selectiveUses,
        wildcard: imports.wildcardUses,
      },
    },
    imports.parseResult.getErrors(),
    imports.parseResult.getWarnings(),
  );
}

export type SchemaMembership =
  | { kind: 'direct' }
  | {
    kind: 'child';
    schemaName: string;
  }
  | { kind: 'none' };

export function schemaMembership (compiler: Compiler, schema: SchemaSymbol, element: ElementDeclarationNode | UseSpecifierNode): SchemaMembership {
  const qualifiedName = schema.qualifiedName;
  let fullname: string[] | undefined;

  if (element instanceof UseSpecifierNode) {
    fullname = useUtils.visibleName(compiler, element);
  } else {
    fullname = compiler.nodeFullname(element).getFiltered(UNHANDLED);
  }
  if (!fullname) return {
    kind: 'none',
  };

  const elementSchemaChain = fullname.length <= 1
    ? [
        DEFAULT_SCHEMA_NAME,
      ]
    : fullname.slice(0, -1);

  if (elementSchemaChain.length < qualifiedName.length) return {
    kind: 'none',
  };
  if (!qualifiedName.every((segment, i) => segment === elementSchemaChain[i])) return {
    kind: 'none',
  };

  if (elementSchemaChain.length === qualifiedName.length) {
    return {
      kind: 'direct',
    };
  }
  return {
    kind: 'child',
    schemaName: elementSchemaChain[qualifiedName.length],
  };
}

// Helpers

function collectImports (compiler: Compiler, filepath: Filepath) {
  const parseResult = compiler.parseFile(filepath);
  const {
    ast,
  } = parseResult.getValue();

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

  return {
    ast,
    parseResult,
    selectiveReuses,
    wildcardReuses,
    selectiveUses,
    wildcardUses,
  };
}

function usableMembersForProgram (
  compiler: Compiler,
  symbol: ProgramSymbol,
  imports: ReturnType<typeof collectImports>,
): {
  nonSchemaMembers: NodeSymbol[];
  schemaMembers: SchemaSymbol[];
} {
  const {
    ast, selectiveUses, selectiveReuses,
  } = imports;
  const filepath = symbol.filepath;

  const fileSchemas = new Map<string, SchemaSymbol>([
    [
      DEFAULT_SCHEMA_NAME,
      compiler.symbolFactory.create(SchemaSymbol, {
        name: DEFAULT_SCHEMA_NAME,
      }, filepath),
    ],
  ]);

  for (const element of ast.declarations) {
    const fullname = compiler.nodeFullname(element).getFiltered(UNHANDLED) || [];
    const schemaName = fullname.length <= 1 ? DEFAULT_SCHEMA_NAME : fullname[0];
    if (!fileSchemas.has(schemaName)) {
      fileSchemas.set(schemaName, compiler.symbolFactory.create(SchemaSymbol, {
        name: schemaName,
      }, filepath));
    }
  }

  registerProgramSchemas(compiler, [
    ...selectiveUses,
    ...selectiveReuses,
  ], fileSchemas, filepath);

  // Visit all reachable files to ensure every program has the same set of schema names
  for (const reachable of compiler.reachableFiles(filepath)) {
    for (const name of collectTopLevelSchemaNames(compiler, reachable)) {
      if (!fileSchemas.has(name)) {
        fileSchemas.set(name, compiler.symbolFactory.create(SchemaSymbol, {
          name,
        }, filepath));
      }
    }
  }

  const schemaMembers = [
    ...fileSchemas.values(),
  ];
  const nonSchemaMembers: NodeSymbol[] = [];

  const publicSchema = schemaMembers.find((s) => s.isPublicSchema());
  if (publicSchema) {
    const publicUsable = compiler.usableMembers(publicSchema).getFiltered(UNHANDLED);
    if (publicUsable) {
      nonSchemaMembers.push(...publicUsable.nonSchemaMembers);
    }
  }

  return {
    nonSchemaMembers,
    schemaMembers,
  };
}

function usableMembersForSchema (
  compiler: Compiler,
  symbol: SchemaSymbol,
  imports: ReturnType<typeof collectImports>,
): {
  nonSchemaMembers: NodeSymbol[];
  schemaMembers: SchemaSymbol[];
} {
  const {
    ast, selectiveUses, selectiveReuses,
  } = imports;
  const nonSchemaMembers: NodeSymbol[] = [];
  const childSchemas = new Map<string, SchemaSymbol>();

  for (const element of ast.body) {
    if (!(element instanceof ElementDeclarationNode)) continue;
    const membership = schemaMembership(compiler, symbol, element);
    const alias = compiler.nodeAlias(element).getFiltered(UNHANDLED);
    const elementSymbol = compiler.nodeSymbol(element).getFiltered(UNHANDLED);
    if (alias !== undefined && symbol.isPublicSchema() && elementSymbol) {
      nonSchemaMembers.push(compiler.symbolFactory.create(
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
      const memberSymbol = compiler.nodeSymbol(element).getFiltered(UNHANDLED);
      if (!memberSymbol) continue;
      nonSchemaMembers.push(memberSymbol);
    } else {
      if (!childSchemas.has(membership.schemaName)) {
        childSchemas.set(
          membership.schemaName,
          compiler.symbolFactory.create(
            SchemaSymbol,
            {
              name: membership.schemaName,
              parent: symbol,
            },
            symbol.filepath,
          ),
        );
      }
    }
  }

  registerSchemaChildren(compiler, [
    ...selectiveUses,
    ...selectiveReuses,
  ], symbol, childSchemas);

  // Visit all reachable files to ensure every schema has the same set of child schema names
  const qualifiedName = symbol.qualifiedName;
  for (const reachable of compiler.reachableFiles(symbol.filepath)) {
    for (const name of collectChildSchemaNames(compiler, reachable, qualifiedName)) {
      if (!childSchemas.has(name)) {
        childSchemas.set(
          name,
          compiler.symbolFactory.create(
            SchemaSymbol,
            {
              name,
              parent: symbol,
            },
            symbol.filepath,
          ),
        );
      }
    }
  }

  return {
    nonSchemaMembers,
    schemaMembers: [
      ...childSchemas.values(),
    ],
  };
}

// Register schemas from use/reuse { schema ... } specifiers at the program level.
// `use { schema x.a }` -> registers top-level `x`.
// `use { schema x.a as b }` -> registers top-level `b` (aliased).
function registerProgramSchemas (
  compiler: Compiler,
  specifiers: UseSpecifierNode[],
  fileSchemas: Map<string, SchemaSymbol>,
  filepath: Filepath,
) {
  for (const specifier of specifiers) {
    if (specifier.getSymbolKind() !== SymbolKind.Schema) continue;
    const parts = useUtils.visibleName(compiler, specifier);
    const name = parts?.at(0);
    if (name !== undefined && !fileSchemas.has(name)) {
      fileSchemas.set(name, compiler.symbolFactory.create(SchemaSymbol, {
        name,
      }, filepath));
    }
  }
}

// Register child schemas from use/reuse { schema ... } specifiers at a schema level.
// `usableMembers(schema_x)` with `use { schema x.a }` -> registers child `a` under `x`.
// Aliased specifiers (e.g. `use { schema x.a as b }`) have visibleName `['b']`,
// which won't match the schema chain - registered at the program level instead.
function registerSchemaChildren (
  compiler: Compiler,
  specifiers: UseSpecifierNode[],
  symbol: SchemaSymbol,
  childSchemas: Map<string, SchemaSymbol>,
) {
  const qualifiedName = symbol.qualifiedName;
  for (const specifier of specifiers) {
    if (specifier.getSymbolKind() !== SymbolKind.Schema) continue;
    const parts = useUtils.visibleName(compiler, specifier);
    if (!parts || parts.length <= qualifiedName.length) continue;
    if (!qualifiedName.every((s, i) => s === parts[i])) continue;
    const childName = parts[qualifiedName.length];
    if (childName && !childSchemas.has(childName)) {
      childSchemas.set(
        childName,
        compiler.symbolFactory.create(
          SchemaSymbol,
          {
            name: childName,
            parent: symbol,
          },
          symbol.filepath,
        ),
      );
    }
  }
}

// Collect top-level schema names from a file's declarations and use/reuse specifiers.
function collectTopLevelSchemaNames (compiler: Compiler, filepath: Filepath): string[] {
  const {
    ast,
  } = compiler.parseFile(filepath).getValue();
  const names: string[] = [];

  for (const element of ast.declarations) {
    const fullname = compiler.nodeFullname(element).getFiltered(UNHANDLED) || [];
    const schemaName = fullname.length <= 1 ? DEFAULT_SCHEMA_NAME : fullname[0];
    names.push(schemaName);
  }

  const imports = collectImports(compiler, filepath);
  for (const specifier of [
    ...imports.selectiveUses,
    ...imports.selectiveReuses,
  ]) {
    if (specifier.getSymbolKind() !== SymbolKind.Schema) continue;
    const parts = useUtils.visibleName(compiler, specifier);
    const name = parts?.at(0);
    if (name !== undefined) names.push(name);
  }

  return names;
}

// Collect child schema names under a given qualified name from a file's declarations and use/reuse specifiers.
function collectChildSchemaNames (compiler: Compiler, filepath: Filepath, parentQualifiedName: string[]): string[] {
  const {
    ast,
  } = compiler.parseFile(filepath).getValue();
  const names: string[] = [];

  for (const element of ast.declarations) {
    const fullname = compiler.nodeFullname(element).getFiltered(UNHANDLED) || [];
    const schemaChain = fullname.length <= 1
      ? [
          DEFAULT_SCHEMA_NAME,
        ]
      : fullname.slice(0, -1);
    if (schemaChain.length > parentQualifiedName.length
      && parentQualifiedName.every((s, i) => s === schemaChain[i])) {
      names.push(schemaChain[parentQualifiedName.length]);
    }
  }

  const imports = collectImports(compiler, filepath);
  for (const specifier of [
    ...imports.selectiveUses,
    ...imports.selectiveReuses,
  ]) {
    if (specifier.getSymbolKind() !== SymbolKind.Schema) continue;
    const parts = useUtils.visibleName(compiler, specifier);
    if (!parts || parts.length <= parentQualifiedName.length) continue;
    if (!parentQualifiedName.every((s, i) => s === parts[i])) continue;
    names.push(parts[parentQualifiedName.length]);
  }

  return names;
}
