import { DEFAULT_SCHEMA_NAME } from '@/constants';
import type Compiler from '../../index';
import { SyntaxNode } from '@/core/parser/nodes';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { TableSymbol } from '@/core/analyzer/symbol/symbols';
import {
  createSchemaSymbolIndex,
  createTableSymbolIndex,
} from '@/core/analyzer/symbol/symbolIndex';
import { applyTextEdits, TextEdit } from './applyTextEdits';
import { isAlphaOrUnderscore, isDigit } from '@/core/utils';

export type TableNameInput = string | { schema?: string; table: string };

interface FormattedTableName {
  schema: string;
  table: string;
  formattedSchema: string;
  formattedTable: string;
  shouldQuoteSchema: boolean;
  shouldQuoteTable: boolean;
}

/**
 * Removes surrounding double quotes from a string if present.
 */
function stripQuotes (str: string): string {
  if (str.startsWith('"') && str.endsWith('"') && str.length >= 2) {
    return str.slice(1, -1);
  }
  return str;
}

/**
 * Normalizes a table name input to { schema, table } format.
 * FIXME: String parsing uses simple split('.') which doesn't handle quoted identifiers with dots
 */
function normalizeTableName (input: TableNameInput): { schema: string; table: string } {
  if (typeof input !== 'string') {
    return {
      schema: input.schema ?? DEFAULT_SCHEMA_NAME,
      table: input.table,
    };
  }

  // FIXME: This simple split doesn't handle quoted identifiers containing dots
  const parts = input.split('.');

  if (parts.length === 1) {
    return {
      schema: DEFAULT_SCHEMA_NAME,
      table: stripQuotes(parts[0]),
    };
  }

  if (parts.length === 2) {
    return {
      schema: stripQuotes(parts[0]),
      table: stripQuotes(parts[1]),
    };
  }

  // More than 2 parts - treat the last as table, rest as schema
  const tablePart = parts.pop()!;
  return {
    schema: stripQuotes(parts.join('.')),
    table: stripQuotes(tablePart),
  };
}

/**
 * Checks if an identifier is valid (can be used without quotes).
 */
function isValidIdentifier (name: string): boolean {
  if (!name) return false;
  return name.split('').every((char) => isAlphaOrUnderscore(char) || isDigit(char)) && !isDigit(name[0]);
}

/**
 * Checks if the table declaration uses quoted identifiers by examining
 * the source text at the declaration node position.
 */
function checkIfTableDeclarationUsesQuotes (
  tableSymbol: TableSymbol,
  source: string,
): boolean {
  if (!tableSymbol.declaration) {
    return false;
  }

  const declarationNode = tableSymbol.declaration as any;
  if (!declarationNode.name) {
    return false;
  }

  const nameNode = declarationNode.name;
  const nameText = source.substring(nameNode.start, nameNode.end);

  // FIXME: This check is fragile
  return nameText.includes('"');
}

/**
 * Formats the new table name with appropriate quoting.
 */
function formatTableName (
  schema: string,
  table: string,
  originalUsedQuotes: boolean,
): FormattedTableName {
  const tableNeedsQuotes = !isValidIdentifier(table);
  const schemaNeedsQuotes = !isValidIdentifier(schema);

  const shouldQuoteTable = originalUsedQuotes || tableNeedsQuotes;
  const shouldQuoteSchema = originalUsedQuotes || schemaNeedsQuotes;

  return {
    schema,
    table,
    formattedSchema: shouldQuoteSchema ? `"${schema}"` : schema,
    formattedTable: shouldQuoteTable ? `"${table}"` : table,
    shouldQuoteSchema,
    shouldQuoteTable,
  };
}

/**
 * Looks up a table symbol from the symbol table.
 */
function lookupTableSymbol (
  symbolTable: Readonly<SymbolTable>,
  schema: string,
  table: string,
): TableSymbol | null {
  const tableSymbolIndex = createTableSymbolIndex(table);

  if (schema === DEFAULT_SCHEMA_NAME) {
    const symbol = symbolTable.get(tableSymbolIndex);
    return symbol instanceof TableSymbol ? symbol : null;
  }

  const schemaSymbolIndex = createSchemaSymbolIndex(schema);
  const schemaSymbol = symbolTable.get(schemaSymbolIndex);

  if (!schemaSymbol || !schemaSymbol.symbolTable) {
    return null;
  }

  const symbol = schemaSymbol.symbolTable.get(tableSymbolIndex);
  return symbol instanceof TableSymbol ? symbol : null;
}

/**
 * Checks if renaming would cause a name collision.
 */
function checkForNameCollision (
  symbolTable: Readonly<SymbolTable>,
  oldSchema: string,
  oldTable: string,
  newSchema: string,
  newTable: string,
): boolean {
  const tableSymbolIndex = createTableSymbolIndex(newTable);
  let existingTableSymbol;

  if (newSchema === DEFAULT_SCHEMA_NAME) {
    existingTableSymbol = symbolTable.get(tableSymbolIndex);
  } else {
    const schemaSymbolIndex = createSchemaSymbolIndex(newSchema);
    const schemaSymbol = symbolTable.get(schemaSymbolIndex);

    if (!schemaSymbol || !schemaSymbol.symbolTable) {
      return false;
    }

    existingTableSymbol = schemaSymbol.symbolTable.get(tableSymbolIndex);
  }

  if (!existingTableSymbol) {
    return false;
  }

  // Not a collision if renaming to the same name
  if (oldSchema === newSchema && oldTable === newTable) {
    return false;
  }

  return true;
}

/**
 * Checks if a node is part of a qualified reference like `schema.table`.
 * Returns the full range including the schema prefix if so.
 * FIXME: This approach is fragile, adhoc and does not scale when we support more elements
 */
function checkIfPartOfQualifiedReference (
  node: SyntaxNode,
  oldSchema: string,
  source: string,
): { start: number; end: number } | null {
  let i = node.start - 1;

  // Skip whitespace
  while (i >= 0 && /\s/.test(source[i])) {
    i--;
  }

  // Check for dot separator
  if (i < 0 || source[i] !== '.') {
    return null;
  }
  i--;

  // Skip whitespace
  while (i >= 0 && /\s/.test(source[i])) {
    i--;
  }

  if (i < 0) {
    return null;
  }

  // Parse schema name backwards
  let schemaStart: number;
  let schemaEnd: number;

  if (source[i] === '"') {
    schemaEnd = i + 1;
    i--;
    while (i >= 0 && source[i] !== '"') {
      i--;
    }
    if (i < 0) return null;
    schemaStart = i;
  } else {
    schemaEnd = i + 1;
    while (i >= 0 && /[a-zA-Z0-9_]/.test(source[i])) {
      i--;
    }
    schemaStart = i + 1;
  }

  const schemaText = source.substring(schemaStart, schemaEnd);
  const cleanSchemaText = stripQuotes(schemaText);

  if (cleanSchemaText === oldSchema) {
    return { start: schemaStart, end: node.end };
  }

  return null;
}

/**
 * Finds all text replacements needed for renaming.
 */
function findReplacements (
  nodes: SyntaxNode[],
  oldSchema: string,
  newFormatted: FormattedTableName,
  source: string,
): TextEdit[] {
  const replacements: TextEdit[] = [];
  const processedRanges = new Set<string>();

  for (const node of nodes) {
    const qualifiedRange = checkIfPartOfQualifiedReference(node, oldSchema, source);

    const range = qualifiedRange ?? { start: node.start, end: node.end };
    const rangeKey = `${range.start}-${range.end}`;

    if (processedRanges.has(rangeKey)) continue;
    processedRanges.add(rangeKey);

    const newText = newFormatted.schema !== DEFAULT_SCHEMA_NAME
      ? `${newFormatted.formattedSchema}.${newFormatted.formattedTable}`
      : newFormatted.formattedTable;

    replacements.push({ start: range.start, end: range.end, newText });
  }

  return replacements;
}

/**
 * Renames a table in the DBML source code.
 *
 * @param oldName - The current table name as string or object (schema defaults to 'public')
 * @param newName - The new table name as string or object (schema defaults to 'public')
 * @returns The updated DBML source code with the table renamed
 *
 * @example
 * // String format
 * compiler.renameTable('users', 'customers');
 * compiler.renameTable('public.users', 'auth.customers');
 *
 * @example
 * // Object format
 * compiler.renameTable({ table: 'users' }, { table: 'customers' });
 * compiler.renameTable(
 *   { schema: 'auth', table: 'users' },
 *   { schema: 'auth', table: 'customers' }
 * );
 */
export function renameTable (
  this: Compiler,
  oldName: TableNameInput,
  newName: TableNameInput,
): string {
  const source = this.parse.source();
  const symbolTable = this.parse.publicSymbolTable();

  const normalizedOld = normalizeTableName(oldName);
  const normalizedNew = normalizeTableName(newName);

  const oldSchema = normalizedOld.schema;
  const oldTable = normalizedOld.table;
  const newSchema = normalizedNew.schema;
  const newTable = normalizedNew.table;

  // Look up the table symbol
  const tableSymbol = lookupTableSymbol(symbolTable, oldSchema, oldTable);
  if (!tableSymbol) {
    return source;
  }

  // Check for name collision
  if (checkForNameCollision(symbolTable, oldSchema, oldTable, newSchema, newTable)) {
    return source;
  }

  // Determine quoting style
  const originalUsedQuotes = checkIfTableDeclarationUsesQuotes(tableSymbol, source);
  const newFormatted = formatTableName(newSchema, newTable, originalUsedQuotes);

  // Collect nodes to rename
  const nodesToRename: SyntaxNode[] = [];

  if (tableSymbol.declaration) {
    const declarationNode = tableSymbol.declaration as any;
    if (declarationNode.name) {
      nodesToRename.push(declarationNode.name);
    }
  }

  for (const ref of tableSymbol.references) {
    const refText = source.substring(ref.start, ref.end);
    const cleanRefText = refText.replace(/"/g, '');
    if (cleanRefText === oldTable) {
      nodesToRename.push(ref);
    }
  }

  // Generate and apply replacements
  const replacements = findReplacements(nodesToRename, oldSchema, newFormatted, source);

  return applyTextEdits(source, replacements);
}
