import type Compiler from '@/compiler';
import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import type {
  Filepath,
} from '@/core/types/filepath';
import {
  UseDeclarationNode,
} from '@/core/types/nodes';
import {
  SchemaSymbol,
} from '@/core/types/symbol';

export function topLevelSchemaMembers (this: Compiler, filepath: Filepath): SchemaSymbol[] {
  const ast = this.parseFile(filepath).getValue().ast;

  // Collect and create schemas
  const schemaMembers = new Map<string, SchemaSymbol>();
  for (const element of ast.body) {
    const fullname = this.nodeFullname(element).getValue();
    if (!Array.isArray(fullname)) continue; // No schema here

    const schemaName = fullname.length <= 1 ? DEFAULT_SCHEMA_NAME : fullname[0]; // When fullname doesn't have a schema name, `public` is assumed
    if (!schemaMembers.has(schemaName)) {
      schemaMembers.set(schemaName, this.symbolFactory.create(SchemaSymbol, {
        name: schemaName,
      }, filepath));
    }
  }

  // A file that only contains use/reuse declarations (no element declarations) still
  // participates in the public schema — it just re-exports symbols from other files.
  // Without this, findSchemaSymbolInFilepath cannot find its public schema and
  // wildcard use * through a reuse chain returns nothing.
  const hasUseDeclarations = ast.body.some((n) => n instanceof UseDeclarationNode);
  if (hasUseDeclarations && !schemaMembers.has(DEFAULT_SCHEMA_NAME)) {
    schemaMembers.set(DEFAULT_SCHEMA_NAME, this.symbolFactory.create(SchemaSymbol, {
      name: DEFAULT_SCHEMA_NAME,
    }, filepath));
  }

  return [...schemaMembers.values()];
}
