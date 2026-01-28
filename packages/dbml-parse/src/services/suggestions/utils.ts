import { SymbolKind, destructureIndex, createColumnSymbolIndex } from '@/core/analyzer/symbol/symbolIndex';
import { CompletionItemKind, CompletionItemInsertTextRule, type CompletionList } from '@/services/types';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { hasTrailingSpaces } from '@/core/lexer/utils';
import { SyntaxNode, TupleExpressionNode, FunctionApplicationNode } from '@/core/parser/nodes';
import Compiler from '@/compiler';
import { ColumnSymbol, TablePartialInjectedColumnSymbol, TablePartialSymbol, TableSymbol } from '@/core/analyzer/symbol/symbols';
import { extractVariableFromExpression } from '@/core/analyzer/utils';
import { addDoubleQuoteIfNeeded } from '@/compiler/queries/utils';

export function pickCompletionItemKind (symbolKind: SymbolKind): CompletionItemKind {
  switch (symbolKind) {
    case SymbolKind.Schema:
      return CompletionItemKind.Module;
    case SymbolKind.Table:
    case SymbolKind.TablePartial:
      return CompletionItemKind.Class;
    case SymbolKind.Column:
    case SymbolKind.TableGroupField:
      return CompletionItemKind.Field;
    case SymbolKind.Enum:
      return CompletionItemKind.Enum;
    case SymbolKind.EnumField:
      return CompletionItemKind.EnumMember;
    case SymbolKind.TableGroup:
      return CompletionItemKind.Struct;
    default:
      return CompletionItemKind.Text;
  }
}

// To determine if autocompletion should insert an additional space before
// inserting other tokens
export function shouldPrependSpace (token: SyntaxToken | undefined, offset: number): boolean {
  if (!token) {
    return false;
  }

  if (hasTrailingSpaces(token)) {
    return false;
  }

  for (const trivia of token.trailingTrivia) {
    if (trivia.start > offset) {
      break;
    }
    if (trivia.kind === SyntaxTokenKind.NEWLINE && trivia.end <= offset) {
      return false;
    }
  }

  return true;
}

export function noSuggestions (): CompletionList {
  return {
    suggestions: [],
  };
}

export function prependSpace (completionList: CompletionList): CompletionList {
  return {
    ...completionList,
    suggestions: completionList.suggestions.map((s) => ({
      ...s,
      insertText: ` ${s.insertText}`,
    })),
  };
}

export function addQuoteToSuggestionIfNeeded (completionList: CompletionList): CompletionList {
  return {
    ...completionList,
    suggestions: completionList.suggestions.map((s) => ({
      ...s,
      insertText: addDoubleQuoteIfNeeded(s.insertText ?? ''),
    })),
  };
}

// Given a completion list with multiple suggestions: `a`, `b`, `c`
// This function returns a new completion list augmented with `a, b, c`
export function addSuggestAllSuggestion (completionList: CompletionList, separator = ', '): CompletionList {
  const allColumns = completionList.suggestions
    .map((s) => typeof s.label === 'string' ? s.label : s.label.label)
    .join(separator);

  if (!allColumns) {
    return completionList;
  }

  return {
    ...completionList,
    suggestions: [
      {
        label: '* (all)',
        insertText: allColumns,
        insertTextRules: CompletionItemInsertTextRule.KeepWhitespace,
        kind: CompletionItemKind.Snippet,
        sortText: '00',
        range: undefined as any,
      },
      ...completionList.suggestions,
    ],
  };
}

// Get the source text of a node or a token
export function getNodeOrTokenSource (compiler: Compiler, tokenOrNode: SyntaxToken | SyntaxNode): string {
  return compiler.parse.source().slice(tokenOrNode.start, tokenOrNode.end);
}

/**
 * Checks if the offset is within the element's header
 * (within the element, but outside the body)
 */
export function isOffsetWithinElementHeader (offset: number, element: SyntaxNode & { body?: SyntaxNode }): boolean {
  // Check if offset is within the element at all
  if (offset < element.start || offset > element.end) {
    return false;
  }

  // If element has a body, check if offset is outside it
  if (element.body) {
    return offset < element.body.start || offset > element.body.end;
  }

  // Element has no body, so entire element is considered header
  return true;
}

export function isTupleEmpty (tuple: TupleExpressionNode): boolean {
  return tuple.commaList.length + tuple.elementList.length === 0;
}

/**
 * Get columns from a table symbol
 * @param tableSymbol The table symbol to extract columns from
 * @returns Array of column objects with name and type information
 */
export function getColumnsFromTableSymbol (
  tableSymbol: TableSymbol | TablePartialSymbol,
): Array<{ name: string; type: string }> | null {
  const columns: Array<{ name: string; type: string }> = [];

  for (const [index, columnSymbol] of tableSymbol.symbolTable.entries()) {
    const res = destructureIndex(index).unwrap_or(undefined);
    if (res === undefined || res.kind !== SymbolKind.Column) continue;
    if (!(columnSymbol instanceof ColumnSymbol || columnSymbol instanceof TablePartialInjectedColumnSymbol)) continue;
    const columnInfo = extractNameAndTypeOfColumnSymbol(columnSymbol, res.name);
    if (!columnInfo) continue;
    columns.push(columnInfo);
  }

  return columns;
}

// This function also works with injected columns
export function extractNameAndTypeOfColumnSymbol (
  columnSymbol: ColumnSymbol | TablePartialInjectedColumnSymbol,
  columnName: string,
): { name: string; type: string } | null {
  const columnIndex = createColumnSymbolIndex(columnName);
  const columnDeclaration = columnSymbol instanceof TablePartialInjectedColumnSymbol
    ? columnSymbol.tablePartialSymbol.symbolTable.get(columnIndex)?.declaration
    : columnSymbol.declaration;
  if (!(columnDeclaration instanceof FunctionApplicationNode)) return null;

  const name = extractVariableFromExpression(columnDeclaration.callee).unwrap_or(null);
  const type = extractVariableFromExpression(columnDeclaration.args[0]).unwrap_or(null);

  if (name === null || type === null) return null;

  return { name, type };
}
