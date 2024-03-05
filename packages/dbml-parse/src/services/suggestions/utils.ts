import { SymbolKind } from '../../lib/analyzer/symbol/symbolIndex';
import { CompletionItemKind, type CompletionList } from '../types';
import { SyntaxToken, SyntaxTokenKind } from '../../lib/lexer/tokens';
import { hasTrailingSpaces } from '../../lib/lexer/utils';
import { isAlphaOrUnderscore } from '../../lib/utils';

export function pickCompletionItemKind(symbolKind: SymbolKind): CompletionItemKind {
  switch (symbolKind) {
    case SymbolKind.Schema:
      return CompletionItemKind.Module;
    case SymbolKind.Table:
      return CompletionItemKind.Class;
    case SymbolKind.Column:
      return CompletionItemKind.Field;
    case SymbolKind.Enum:
      return CompletionItemKind.Enum;
    case SymbolKind.EnumField:
      return CompletionItemKind.EnumMember;
    case SymbolKind.TableGroup:
      return CompletionItemKind.Struct;
    case SymbolKind.TableGroupField:
      return CompletionItemKind.Field;
    default:
      return CompletionItemKind.Text;
  }
}

// To determine if autocompletion should insert an additional space before
// inserting other tokens
export function shouldPrependSpace(token: SyntaxToken | undefined, offset: number): boolean {
  if (!token) {
    return false;
  }

  if (hasTrailingSpaces(token)) {
    return false;
  }

  // eslint-disable-next-line no-restricted-syntax
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

export function noSuggestions(): CompletionList {
  return {
    suggestions: [],
  };
}

export function prependSpace(completionList: CompletionList): CompletionList {
  return {
    ...completionList,
    suggestions: completionList.suggestions.map((s) => ({
      ...s,
      insertText: ` ${s.insertText}`,
    })),
  };
}

export function addQuoteIfNeeded(completionList: CompletionList): CompletionList {
  return {
    ...completionList,
    suggestions: completionList.suggestions.map((s) => ({
      ...s,
      insertText: (!s.insertText.split('').every(isAlphaOrUnderscore)) ? `"${s.insertText}"` : s.insertText,
    })),
  };
}
