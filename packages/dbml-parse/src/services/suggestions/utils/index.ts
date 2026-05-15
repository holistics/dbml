import { addDoubleQuoteIfNeeded } from '@/compiler/queries/utils';
import { hasTrailingSpaces } from '@/core/lexer/utils';
import { SymbolKind } from '@/core/types/symbol';
import { SyntaxToken, SyntaxTokenKind } from '@/core/types/tokens';
import { CompletionItemInsertTextRule, CompletionItemKind, type CompletionList } from '@/services/types';

export * from './useMerger';

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
      insertText: s.quoted ? s.insertText : addDoubleQuoteIfNeeded(s.insertText ?? ''),
      quoted: true,
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
