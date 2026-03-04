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

/**
 * Creates a new DiagramView block in DBML code.
 *
 * @param {string} name - The name of the DiagramView
 * @param {string[]} tables - Array of table names to include
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with the new DiagramView
 */
export function createDiagramView (name, tables, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.createDiagramView(name, tables, dbmlCode);
}

/**
 * Updates an existing DiagramView block in DBML code.
 *
 * @param {string} name - The name of the DiagramView to update
 * @param {string[]} tables - Array of table names to include
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with the updated DiagramView
 */
export function updateDiagramView (name, tables, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.updateDiagramView(name, tables, dbmlCode);
}

/**
 * Renames an existing DiagramView block in DBML code.
 *
 * @param {string} oldName - The current name of the DiagramView
 * @param {string} newName - The new name for the DiagramView
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with the renamed DiagramView
 */
export function renameDiagramView (oldName, newName, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.renameDiagramView(oldName, newName, dbmlCode);
}

/**
 * Deletes an existing DiagramView block from DBML code.
 *
 * @param {string} name - The name of the DiagramView to delete
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with the DiagramView removed
 */
export function deleteDiagramView (name, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.deleteDiagramView(name, dbmlCode);
}

/**
 * Creates DiagramView blocks for multiple database views.
 *
 * @param {Array<{name: string, tables: string[]}>} dbViews - Array of database views
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with all DiagramViews
 */
export function migrateViewsToDbml (dbViews, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.migrateViewsToDbml(dbViews, dbmlCode);
}

/**
 * Unified function that handles:
 * 1. User's operation (create/update/rename)
 * 2. Auto-migration of DB views that don't have DBML blocks yet
 *
 * @param {Object} operation - The operation to perform
 * @param {string} operation.type - 'create' | 'update' | 'rename'
 * @param {string} [operation.oldName] - Old name for rename operation
 * @param {string} operation.newName - New name for the view
 * @param {Object} [operation.filterConfig] - FilterConfig for the view
 * @param {Array} allDbViews - All DB views to potentially migrate
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code
 */
export function syncDiagramViews (operation, allDbViews, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.syncDiagramViews(operation, allDbViews, dbmlCode);
}
