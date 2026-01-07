import { SyntaxToken, SyntaxTokenKind } from '@/lib/lexer/tokens';
import {
  createSchemaSymbolIndex,
  createTableSymbolIndex,
} from '@/lib/analyzer/symbol/symbolIndex';
import { TableSymbol } from '@/lib/analyzer/symbol/symbols';
import SymbolTable from '@/lib/analyzer/symbol/symbolTable';
import { SyntaxNode, InfixExpressionNode, PrimaryExpressionNode } from '@/lib/parser/nodes';

const DEFAULT_SCHEMA_NAME = 'public';

interface TableNameParts {
  schemaName: string;
  tableName: string;
}

interface FormattedTableNameParts extends TableNameParts {
  rawSchemaName: string;
  rawTableName: string;
  shouldQuoteTable: boolean;
  shouldQuoteSchema: boolean;
}

interface Replacement {
  start: number;
  end: number;
  newText: string;
}

/**
 * Renames a table in DBML code using symbol table and AST nodes
 *
 * @param oldTableName - The current table name (e.g., "users" or "public.users")
 * @param newTableName - The new table name (e.g., "customers" or "private.customers")
 * @param source - The DBML source code
 * @param symbolTable - The symbol table from Compiler.parse.publicSymbolTable()
 * @param tokens - The tokens from Compiler.parse.tokens()
 * @returns The updated DBML code with the renamed table
 */
export function renameTable(
  oldTableName: string,
  newTableName: string,
  source: string,
  symbolTable: SymbolTable,
  tokens: readonly SyntaxToken[],
): string {
  // Parse table names
  const oldParts = parseTableName(oldTableName);
  const newPartsRaw = parseTableName(newTableName);

  // Validate new table name - add quotes if necessary
  const validationResult = validateAndQuoteTableName(newPartsRaw, source, oldParts);
  if (!validationResult.isValid) {
    return source;
  }

  const newParts: FormattedTableNameParts = {
    tableName: validationResult.tableName,
    schemaName: validationResult.schemaName,
    rawTableName: newPartsRaw.tableName,
    rawSchemaName: newPartsRaw.schemaName,
    shouldQuoteTable: validationResult.shouldQuoteTable,
    shouldQuoteSchema: validationResult.shouldQuoteSchema,
  };

  // Check for name collision using symbol table
  if (checkForNameCollision(symbolTable, oldParts, newParts)) {
    return source;
  }

  // Find the table symbol
  const tableSymbolIndex = createTableSymbolIndex(oldParts.tableName);
  let tableSymbol;

  if (oldParts.schemaName === DEFAULT_SCHEMA_NAME) {
    // For public schema, look directly at the top level
    tableSymbol = symbolTable.get(tableSymbolIndex);
  } else {
    // For other schemas, look under the schema symbol
    const schemaSymbolIndex = createSchemaSymbolIndex(oldParts.schemaName);
    const schemaSymbol = symbolTable.get(schemaSymbolIndex);
    if (!schemaSymbol || !schemaSymbol.symbolTable) {
      return source;
    }
    tableSymbol = schemaSymbol.symbolTable.get(tableSymbolIndex);
  }

  if (!tableSymbol || !(tableSymbol instanceof TableSymbol)) {
    return source;
  }

  // Collect all nodes that need renaming: declaration name + matching references
  const nodesToRename: SyntaxNode[] = [];
  if (tableSymbol.declaration) {
    // Use the name node of the declaration, not the entire declaration
    const declarationNode = tableSymbol.declaration as any;
    if (declarationNode.name) {
      nodesToRename.push(declarationNode.name);
    }
  }

  // Filter references: only include those that actually use the name being renamed
  // This handles the case where a table has an alias - we only rename references
  // that use the specific name (table name vs alias name)
  for (const ref of tableSymbol.references) {
    const refText = source.substring(ref.start, ref.end);
    // Remove quotes if present for comparison
    const cleanRefText = refText.replace(/"/g, '');
    if (cleanRefText === oldParts.tableName) {
      nodesToRename.push(ref);
    }
  }

  // Find replacements for each node
  const replacements = findReplacements(
    nodesToRename,
    tokens,
    oldParts,
    newParts,
    source,
  );

  // Apply replacements in reverse order
  return applyReplacements(source, replacements);
}

/**
 * Parses a table name that may be schema-qualified
 */
function parseTableName(tableName: string): TableNameParts {
  const parts = tableName.split('.');
  if (parts.length === 2 && parts[0] && parts[1]) {
    return {
      schemaName: parts[0],
      tableName: parts[1],
    };
  }
  return {
    schemaName: DEFAULT_SCHEMA_NAME,
    tableName: tableName,
  };
}

/**
 * Validates a table name and determines if it needs quotes
 */
function validateAndQuoteTableName(
  nameParts: TableNameParts,
  dbmlSource: string,
  oldParts: TableNameParts,
): {
    isValid: boolean;
    tableName: string;
    schemaName: string;
    shouldQuoteTable: boolean;
    shouldQuoteSchema: boolean;
  } {
  const { tableName, schemaName } = nameParts;

  // Check if original table name used quotes
  const originalUsedQuotes = checkIfTableUsesQuotes(dbmlSource, oldParts);

  const isValidIdentifier = (name: string) => {
    return /^[a-zA-Z0-9_]+$/.test(name);
  };

  const tableNeedsQuotes = !isValidIdentifier(tableName);
  const schemaNeedsQuotes = !isValidIdentifier(schemaName);

  const shouldQuoteTable = originalUsedQuotes || tableNeedsQuotes;
  const shouldQuoteSchema = originalUsedQuotes || schemaNeedsQuotes;

  const formattedTableName = shouldQuoteTable ? `"${tableName}"` : tableName;
  const formattedSchemaName = shouldQuoteSchema ? `"${schemaName}"` : schemaName;

  return {
    isValid: true,
    tableName: formattedTableName,
    schemaName: formattedSchemaName,
    shouldQuoteTable,
    shouldQuoteSchema,
  };
}

/**
 * Checks if a table name uses quotes in the original source
 */
function checkIfTableUsesQuotes(source: string, tableParts: TableNameParts): boolean {
  const quotedPattern =
    tableParts.schemaName !== DEFAULT_SCHEMA_NAME
      ? new RegExp(
          `Table\\s+"${escapeRegex(tableParts.schemaName)}"\\."${escapeRegex(tableParts.tableName)}"`,
        )
      : new RegExp(`Table\\s+"${escapeRegex(tableParts.tableName)}"`);

  return quotedPattern.test(source);
}

/**
 * Escapes special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks if renaming would create a name collision
 */
function checkForNameCollision(
  symbolTable: SymbolTable,
  oldParts: TableNameParts,
  newParts: FormattedTableNameParts,
): boolean {
  const tableSymbolIndex = createTableSymbolIndex(newParts.rawTableName);
  let existingTableSymbol;

  if (newParts.rawSchemaName === DEFAULT_SCHEMA_NAME) {
    // For public schema, check directly at the top level
    existingTableSymbol = symbolTable.get(tableSymbolIndex);
  } else {
    // For other schemas, check under the schema symbol
    const schemaSymbolIndex = createSchemaSymbolIndex(newParts.rawSchemaName);
    const schemaSymbol = symbolTable.get(schemaSymbolIndex);

    if (!schemaSymbol || !schemaSymbol.symbolTable) {
      return false;
    }

    existingTableSymbol = schemaSymbol.symbolTable.get(tableSymbolIndex);
  }

  if (!existingTableSymbol) {
    return false;
  }

  if (
    oldParts.schemaName === newParts.rawSchemaName &&
    oldParts.tableName === newParts.rawTableName
  ) {
    return false;
  }

  return true;
}

/**
 * Finds all replacements needed for the given nodes
 */
function findReplacements(
  nodes: SyntaxNode[],
  tokens: readonly SyntaxToken[],
  oldParts: TableNameParts,
  newParts: FormattedTableNameParts,
  source: string,
): Replacement[] {
  const replacements: Replacement[] = [];
  const processedRanges = new Set<string>();

  for (const node of nodes) {
    // Check if this node is part of a schema.table qualified reference
    const qualifiedRange = checkIfPartOfQualifiedReference(node, tokens, oldParts, source);

    if (qualifiedRange) {
      const rangeKey = `${qualifiedRange.start}-${qualifiedRange.end}`;
      if (processedRanges.has(rangeKey)) continue;
      processedRanges.add(rangeKey);

      // Replace the qualified reference
      const newText =
        newParts.rawSchemaName !== DEFAULT_SCHEMA_NAME
          ? `${newParts.schemaName}.${newParts.tableName}`
          : newParts.tableName;

      replacements.push({
        start: qualifiedRange.start,
        end: qualifiedRange.end,
        newText,
      });
    } else {
      // Unqualified reference - replace just the table name
      const rangeKey = `${node.start}-${node.end}`;
      if (processedRanges.has(rangeKey)) continue;
      processedRanges.add(rangeKey);

      const newText =
        newParts.rawSchemaName !== DEFAULT_SCHEMA_NAME
          ? `${newParts.schemaName}.${newParts.tableName}`
          : newParts.tableName;

      replacements.push({
        start: node.start,
        end: node.end,
        newText,
      });
    }
  }

  return replacements;
}

/**
 * Checks if a node is part of a qualified reference (schema.table)
 * Returns the range of the full qualified reference if found
 */
function checkIfPartOfQualifiedReference(
  node: SyntaxNode,
  tokens: readonly SyntaxToken[],
  oldParts: TableNameParts,
  source: string,
): { start: number; end: number } | null {
  // Look backwards in tokens to see if there's schema.
  const nodeText = source.substring(node.start, node.end);

  // Check if there's a schema qualifier before this node
  let i = node.start - 1;

  // Skip whitespace backwards
  while (i >= 0 && /\s/.test(source[i])) {
    i--;
  }

  // Check for dot
  if (i < 0 || source[i] !== '.') {
    return null;
  }
  const dotPos = i;
  i--;

  // Skip whitespace before dot
  while (i >= 0 && /\s/.test(source[i])) {
    i--;
  }

  // Now find the schema name
  let schemaEnd = i + 1;
  let schemaStart = schemaEnd;

  // Handle quoted identifier
  if (i >= 0 && source[i] === '"') {
    schemaEnd = i + 1;
    i--;
    while (i >= 0 && source[i] !== '"') {
      i--;
    }
    if (i < 0) return null;
    schemaStart = i;
  } else {
    // Unquoted identifier
    while (i >= 0 && /[a-zA-Z0-9_]/.test(source[i])) {
      i--;
    }
    schemaStart = i + 1;
  }

  const schemaText = source.substring(schemaStart, schemaEnd);
  const cleanSchemaText = schemaText.replace(/"/g, '');

  // Check if this matches our old schema
  if (cleanSchemaText === oldParts.schemaName) {
    return {
      start: schemaStart,
      end: node.end,
    };
  }

  return null;
}

/**
 * Applies all replacements to the source code in reverse order
 */
function applyReplacements(source: string, replacements: Replacement[]): string {
  const sortedReplacements = [...replacements].sort((a, b) => b.start - a.start);

  let result = source;
  for (const { start, end, newText } of sortedReplacements) {
    result = result.substring(0, start) + newText + result.substring(end);
  }

  return result;
}
