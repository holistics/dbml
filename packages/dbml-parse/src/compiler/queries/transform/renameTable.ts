import {
  DEFAULT_SCHEMA_NAME,
} from '@/constants';
import type Compiler from '../../index';
import {
  SyntaxNode,
} from '@/core/types/nodes';
import {
  NodeSymbol,
} from '@/core/types/symbol';
import {
  applyTextEdits, TextEdit,
} from './applyTextEdits';
import {
  isAlphaOrUnderscore, isDigit,
} from '@/core/utils/chars';
import {
  normalizeTableName, lookupTableSymbol, stripQuotes, type TableNameInput,
} from './utils';
import {
  Filepath,
} from '@/core/types/filepath';

interface FormattedTableName {
  schema: string;
  table: string;
  formattedSchema: string;
  formattedTable: string;
  shouldQuoteSchema: boolean;
  shouldQuoteTable: boolean;
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
  tableSymbol: NodeSymbol,
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
 * Checks if renaming would cause a name collision.
 */
function checkForNameCollision (
  compiler: Compiler,
  filepath: Filepath,
  oldSchema: string,
  oldTable: string,
  newSchema: string,
  newTable: string,
): boolean {
  if (oldSchema === newSchema && oldTable === newTable) return false;
  const existing = lookupTableSymbol(compiler, filepath, newSchema, newTable);
  return existing !== null;
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
): { start: number;
  end: number; } | null {
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
    return {
      start: schemaStart,
      end: node.end,
    };
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

    const range = qualifiedRange ?? {
      start: node.start,
      end: node.end,
    };
    const rangeKey = `${range.start}-${range.end}`;

    if (processedRanges.has(rangeKey)) continue;
    processedRanges.add(rangeKey);

    const newText = newFormatted.schema !== DEFAULT_SCHEMA_NAME
      ? `${newFormatted.formattedSchema}.${newFormatted.formattedTable}`
      : newFormatted.formattedTable;

    replacements.push({
      start: range.start,
      end: range.end,
      newText,
    });
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
  filepath: Filepath,
  oldName: TableNameInput,
  newName: TableNameInput,
): string {
  const source = this.layout.getSource(filepath) ?? '';

  const normalizedOld = normalizeTableName(oldName);
  const normalizedNew = normalizeTableName(newName);

  const oldSchema = normalizedOld.schema;
  const oldTable = normalizedOld.table;
  const newSchema = normalizedNew.schema;
  const newTable = normalizedNew.table;

  // Look up the table symbol
  const tableSymbol = lookupTableSymbol(this, filepath, oldSchema, oldTable);
  if (!tableSymbol) {
    return source;
  }

  // Check for name collision
  if (checkForNameCollision(this, filepath, oldSchema, oldTable, newSchema, newTable)) {
    return source;
  }

  // Only rename when the symbol is declared in the target file.
  // Imported (UseSymbol) entries point to declarations in another file — callers
  // must rename the declaring file directly.
  const declarationNode = tableSymbol.declaration as any;
  if (!declarationNode || declarationNode.filepath?.absolute !== filepath.absolute) {
    return source;
  }

  // Determine quoting style
  const originalUsedQuotes = checkIfTableDeclarationUsesQuotes(tableSymbol, source);
  const newFormatted = formatTableName(newSchema, newTable, originalUsedQuotes);

  // Collect nodes to rename
  const nodesToRename: SyntaxNode[] = [];

  if (declarationNode.name) {
    nodesToRename.push(declarationNode.name);
  }

  const referencesReport = this.symbolReferences(tableSymbol);
  const references = referencesReport.getValue();
  for (const ref of references) {
    // Only rename references that live in the target file — other files have
    // different source offsets and are not rewritten by this call.
    if (ref.filepath.absolute !== filepath.absolute) continue;
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
