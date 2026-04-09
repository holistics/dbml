import type Compiler from '@/compiler';
import { DEFAULT_SCHEMA_NAME } from '@/constants';
import { SchemaSymbol } from '@/core/types';
import type { Filepath } from '@/core/types/filepath';

export function topLevelSchemaMembers (this: Compiler, filepath: Filepath): SchemaSymbol[] {
  const ast = this.parseFile(filepath).getValue().ast;

  // Collect and create schemas
  const schemaMembers = new Map<string, SchemaSymbol>();
  for (const element of ast.body) {
    const fullname = this.nodeFullname(element).getValue();
    if (!Array.isArray(fullname)) continue; // No schema here

    const schemaName = fullname.length <= 1 ? DEFAULT_SCHEMA_NAME : fullname[0]; // When fullname doesn't have a schema name, `public` is assumed
    if (!schemaMembers.has(schemaName)) {
      schemaMembers.set(schemaName, this.symbolFactory.create(SchemaSymbol, { name: schemaName }, filepath));
    }
  }

  return [...schemaMembers.values()];
}
