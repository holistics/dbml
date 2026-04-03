import { Compiler } from '@dbml/parse';

/**
 * Renames a table in DBML code using symbol table and token-based replacement.
 * @example
 * // String format
 * renameTable('users', 'customers', dbmlCode);
 * renameTable('public.users', 'auth.customers', dbmlCode);
 *
 * @example
 * // Object format
 * renameTable({ table: 'users' }, { table: 'customers' }, dbmlCode);
 * renameTable({ schema: 'auth', table: 'users' }, { schema: 'auth', table: 'customers' }, dbmlCode);
 */
export function renameTable (
  oldName:string | { schema?: string; table: string },
  newName: string | { schema?: string; table: string },
  dbmlCode: string,
): string {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.renameTable(oldName, newName);
}
