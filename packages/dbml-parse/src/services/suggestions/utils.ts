import { SymbolKind, destructureIndex } from '@/core/analyzer/symbol/symbolIndex';
import { CompletionItemKind, CompletionItemInsertTextRule, type CompletionList } from '@/services/types';
import { SyntaxToken, SyntaxTokenKind } from '@/core/lexer/tokens';
import { hasTrailingSpaces } from '@/core/lexer/utils';
import { isAlphaOrUnderscore } from '@/core/utils';
import { SyntaxNode, TupleExpressionNode } from '@/core/parser/nodes';
import Compiler from '@/compiler';

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

export function addQuoteIfNeeded (completionList: CompletionList): CompletionList {
  return {
    ...completionList,
    suggestions: completionList.suggestions.map((s) => ({
      ...s,
      insertText: (!s.insertText || !s.insertText.split('').every(isAlphaOrUnderscore)) ? `"${s.insertText ?? ''}"` : s.insertText,
    })),
  };
}

export function excludeSuggestions (completionList: CompletionList, excludeLabels: string[]): CompletionList {
  return {
    ...completionList,
    suggestions: completionList.suggestions.filter((s) => {
      const label = typeof s.label === 'string' ? s.label : s.label.label;
      return !excludeLabels.includes(label.toLowerCase());
    }),
  };
}

export function addExpandAllColumnsSuggestion (completionList: CompletionList): CompletionList {
  const allColumns = completionList.suggestions
    .map((s) => typeof s.label === 'string' ? s.label : s.label.label)
    .join(', ');

  if (!allColumns) {
    return completionList;
  }

  return {
    ...completionList,
    suggestions: [
      {
        label: '* (all columns)',
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

export function getSource (compiler: Compiler, tokenOrNode: SyntaxToken | SyntaxNode): string {
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
 * @param compiler Optional compiler instance to extract type names from source
 * @returns Array of column objects with name and type information
 */
export function getColumnsFromTableSymbol (
  tableSymbol: any,
  compiler?: Compiler,
): Array<{ name: string; type: string }> {
  const columns: Array<{ name: string; type: string }> = [];

  for (const [index] of tableSymbol.symbolTable.entries()) {
    const res = destructureIndex(index).unwrap_or(undefined);
    if (res === undefined || res.kind !== SymbolKind.Column) continue;

    const columnSymbol = tableSymbol.symbolTable.get(index);
    if (columnSymbol) {
      let type = 'value';

      // Try to extract type from column declaration
      if (compiler && columnSymbol.declaration) {
        const declaration = columnSymbol.declaration;
        // Column declaration is a FunctionApplicationNode like: id int [pk]
        // The args[0] is the type
        if (declaration.args && declaration.args[0]) {
          type = getSource(compiler, declaration.args[0]);
        }
      }

      columns.push({ name: res.name, type });
    }
  }

  return columns;
}

/**
 * Generate a snippet for entering a record entry with placeholders for each column
 * @param columns Array of column objects with name and type information
 * @returns A snippet string with placeholders like: ${1:id (int)}, ${2:name (varchar)}, ${3:email (varchar)}
 */
export function generateRecordEntrySnippet (columns: Array<{ name: string; type: string }>): string {
  if (columns.length === 0) {
    return '';
  }

  return columns
    .map((col, index) => `\${${index + 1}:${col.name} (${col.type})}`)
    .join(', ');
}
