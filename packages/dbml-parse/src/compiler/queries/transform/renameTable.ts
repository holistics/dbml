import type Compiler from '../../index';
import { SyntaxNode } from '@/core/parser/nodes';
import SymbolTable from '@/core/analyzer/symbol/symbolTable';
import { TableSymbol } from '@/core/analyzer/symbol/symbols';
import {
  createSchemaSymbolIndex,
  createTableSymbolIndex,
} from '@/core/analyzer/symbol/symbolIndex';

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

function parseTableName (tableName: string): TableNameParts {
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

function escapeRegex (str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function checkIfTableUsesQuotes (source: string, tableParts: TableNameParts): boolean {
  const quotedPattern =
    tableParts.schemaName !== DEFAULT_SCHEMA_NAME
      ? new RegExp(
          `Table\\s+"${escapeRegex(tableParts.schemaName)}"\\."${escapeRegex(tableParts.tableName)}"`,
        )
      : new RegExp(`Table\\s+"${escapeRegex(tableParts.tableName)}"`);

  return quotedPattern.test(source);
}

function validateAndQuoteTableName (
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

function checkForNameCollision (
  symbolTable: Readonly<SymbolTable>,
  oldParts: TableNameParts,
  newParts: FormattedTableNameParts,
): boolean {
  const tableSymbolIndex = createTableSymbolIndex(newParts.rawTableName);
  let existingTableSymbol;

  if (newParts.rawSchemaName === DEFAULT_SCHEMA_NAME) {
    existingTableSymbol = symbolTable.get(tableSymbolIndex);
  } else {
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
    oldParts.schemaName === newParts.rawSchemaName
    && oldParts.tableName === newParts.rawTableName
  ) {
    return false;
  }

  return true;
}

function checkIfPartOfQualifiedReference (
  node: SyntaxNode,
  oldParts: TableNameParts,
  source: string,
): { start: number; end: number } | null {
  let i = node.start - 1;

  while (i >= 0 && /\s/.test(source[i])) {
    i--;
  }

  if (i < 0 || source[i] !== '.') {
    return null;
  }
  i--;

  while (i >= 0 && /\s/.test(source[i])) {
    i--;
  }

  let schemaEnd = i + 1;
  let schemaStart = schemaEnd;

  if (i >= 0 && source[i] === '"') {
    schemaEnd = i + 1;
    i--;
    while (i >= 0 && source[i] !== '"') {
      i--;
    }
    if (i < 0) return null;
    schemaStart = i;
  } else {
    while (i >= 0 && /[a-zA-Z0-9_]/.test(source[i])) {
      i--;
    }
    schemaStart = i + 1;
  }

  const schemaText = source.substring(schemaStart, schemaEnd);
  const cleanSchemaText = schemaText.replace(/"/g, '');

  if (cleanSchemaText === oldParts.schemaName) {
    return {
      start: schemaStart,
      end: node.end,
    };
  }

  return null;
}

function findReplacements (
  nodes: SyntaxNode[],
  oldParts: TableNameParts,
  newParts: FormattedTableNameParts,
  source: string,
): Replacement[] {
  const replacements: Replacement[] = [];
  const processedRanges = new Set<string>();

  for (const node of nodes) {
    const qualifiedRange = checkIfPartOfQualifiedReference(node, oldParts, source);

    if (qualifiedRange) {
      const rangeKey = `${qualifiedRange.start}-${qualifiedRange.end}`;
      if (processedRanges.has(rangeKey)) continue;
      processedRanges.add(rangeKey);

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

function applyReplacements (source: string, replacements: Replacement[]): string {
  const sortedReplacements = [...replacements].sort((a, b) => b.start - a.start);

  let result = source;
  for (const { start, end, newText } of sortedReplacements) {
    result = result.substring(0, start) + newText + result.substring(end);
  }

  return result;
}

export function renameTable (
  this: Compiler,
  oldTableName: string,
  newTableName: string,
): string {
  const source = this.parse.source();
  const symbolTable = this.parse.publicSymbolTable();

  const oldParts = parseTableName(oldTableName);
  const newPartsRaw = parseTableName(newTableName);

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

  if (checkForNameCollision(symbolTable, oldParts, newParts)) {
    return source;
  }

  const tableSymbolIndex = createTableSymbolIndex(oldParts.tableName);
  let tableSymbol;

  if (oldParts.schemaName === DEFAULT_SCHEMA_NAME) {
    tableSymbol = symbolTable.get(tableSymbolIndex);
  } else {
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
    if (cleanRefText === oldParts.tableName) {
      nodesToRename.push(ref);
    }
  }

  const replacements = findReplacements(
    nodesToRename,
    oldParts,
    newParts,
    source,
  );

  return applyReplacements(source, replacements);
}
