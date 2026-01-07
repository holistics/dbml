import { Compiler } from '@dbml/parse';

/**
 * Renames a table in DBML code using symbol table and token-based replacement
 *
 * @param {string} oldTableName - The current table name. Can be:
 *                                 - "users" (no schema → defaults to public schema)
 *                                 - "public.users" (explicit schema)
 * @param {string} newTableName - The new table name. Can be:
 *                                 - "customers" (no schema → defaults to public schema)
 *                                 - "private.customers" (explicit schema)
 * @param {string} dbmlCode - The DBML code containing the table
 * @returns {string} The updated DBML code with the renamed table
 */
function renameTable (oldTableName, newTableName, dbmlCode) {
  // Create compiler instance and parse the DBML code
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);

  try {
    // Use the renameTable method from the Compiler instance
    return compiler.renameTable(oldTableName, newTableName);
  } catch (error) {
    // If parsing fails or renaming fails, return unchanged code
    return dbmlCode;
  }
}

export default renameTable;
