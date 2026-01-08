import { Compiler } from '@dbml/parse';

/**
 * Renames a table in DBML code using symbol table and token-based replacement.
 *
 * @param {{ schema?: string; table: string }} oldName - The current table name
 * @param {{ schema?: string; table: string }} newName - The new table name
 * @param {string} dbmlCode - The DBML code containing the table
 * @returns {string} The updated DBML code with the renamed table
 *
 * @example
 * // Rename a table in the default schema
 * renameTable({ table: 'users' }, { table: 'customers' }, dbmlCode);
 *
 * @example
 * // Rename a table with schema
 * renameTable({ schema: 'auth', table: 'users' }, { schema: 'auth', table: 'customers' }, dbmlCode);
 */
export function renameTable (oldName, newName, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.renameTable(oldName, newName);
}
