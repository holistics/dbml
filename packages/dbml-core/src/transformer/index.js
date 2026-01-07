import { Compiler } from '@dbml/parse';

/**
 * Renames a table in DBML code using symbol table and token-based replacement
 *
 * @param {string} oldTableName - The current table name (e.g., "users" or "public.users")
 * @param {string} newTableName - The new table name (e.g., "customers" or "private.customers")
 * @param {string} dbmlCode - The DBML code containing the table
 * @returns {string} The updated DBML code with the renamed table
 */
function renameTable (oldTableName, newTableName, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.renameTable(oldTableName, newTableName);
}

export default {
  renameTable,
};
