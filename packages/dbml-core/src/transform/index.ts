import { Compiler } from '@dbml/parse';

/**
 * Renames a table in DBML code using symbol table and token-based replacement.
 *
 * @param {string | { schema?: string; table: string }} oldName - The current table name
 * @param {string | { schema?: string; table: string }} newName - The new table name
 * @param {string} dbmlCode - The DBML code containing the table
 * @returns {string} The updated DBML code with the renamed table
 *
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
export function renameTable (oldName, newName, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.renameTable(oldName, newName);
}
