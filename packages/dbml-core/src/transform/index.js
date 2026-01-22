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
 * Appends records to a table in DBML code.
 *
 * @param {string | { schema?: string; table: string }} tableName - The table name
 * @param {string[]} columns - The column names
 * @param {Array<Array<any>>} values - The values to append (array of rows)
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with the appended records
 *
 * @example
 * appendRecords('users', ['id', 'name'], [[1, 'Alice'], [2, 'Bob']], dbmlCode);
 */
export function appendRecords (tableName, columns, values, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.appendRecords(tableName, columns, values);
}

/**
 * Updates a specific field in a record row.
 *
 * @param {string | { schema?: string; table: string }} tableName - The table name
 * @param {number} rowIndex - The zero-based row index
 * @param {string} fieldName - The field/column name to update
 * @param {any} newValue - The new value
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with the modified field
 *
 * @example
 * updateRecordField('users', 0, 'name', 'Charlie', dbmlCode);
 */
export function updateRecordField (tableName, rowIndex, fieldName, newValue, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.updateRecordField(tableName, rowIndex, fieldName, newValue);
}

/**
 * Deletes a record row from a table.
 *
 * @param {string | { schema?: string; table: string }} tableName - The table name
 * @param {number} rowIndex - The zero-based row index to delete
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with the row removed
 *
 * @example
 * deleteRecordRow('users', 1, dbmlCode);
 */
export function deleteRecordRow (tableName, rowIndex, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.deleteRecordRow(tableName, rowIndex);
}

/**
 * Deletes a specific value in a record (sets it to null).
 *
 * @param {string | { schema?: string; table: string }} tableName - The table name
 * @param {number} rowIndex - The zero-based row index
 * @param {string} columnName - The column name
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with the value deleted
 *
 * @example
 * deleteRecordValue('users', 0, 'email', dbmlCode);
 */
export function deleteRecordValue (tableName, rowIndex, columnName, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.deleteRecordValue(tableName, rowIndex, columnName);
}

/**
 * Removes all records for a table.
 *
 * @param {string | { schema?: string; table: string }} tableName - The table name
 * @param {string} dbmlCode - The DBML code
 * @returns {string} The updated DBML code with all records removed
 *
 * @example
 * removeAllRecords('users', dbmlCode);
 */
export function removeAllRecords (tableName, dbmlCode) {
  const compiler = new Compiler();
  compiler.setSource(dbmlCode);
  return compiler.removeAllRecords(tableName);
}
