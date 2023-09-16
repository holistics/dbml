import { TokenLogicalLineIterator } from '../iterator';
import { SymbolKind } from '../lib/analyzer/symbol/symbolIndex';
import { CompletionItemKind, Position, TextModel } from './types';
import { ElementKind } from '../lib/analyzer/validator/types';
import { SyntaxToken, SyntaxTokenKind } from '../lib/lexer/tokens';
import { toElementKind } from '../lib/analyzer/validator/utils';
import { hasTrailingSpaces } from '../lib/lexer/utils';

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

// Check if the current cursor is right after :, with out any other non-trivial characters
// This check is more restrictive when we're at top-level
// as in top level, an element declaration "header" can span many line
// e.g
// Ref
// A
// :
// ...
// This check enforces that every token of the element header must be on the same line
// It allows trailing newlines after :
// which is the behavior inside nested scope
// Ref A:
//  ...
// Ref: ...
// Type A as B: ...
// Type A as B:
//  ...
export function isAtStartOfSimpleBody(
  iter: TokenLogicalLineIterator,
  elementKind: ElementKind,
): boolean {
  let line = iter.collectFromStart().unwrap_or([]);
  const maybeColon = line.pop();
  if (maybeColon?.kind !== SyntaxTokenKind.COLON) {
    return false;
  }
  const maybeType = line.shift();
  if (!maybeType || toElementKind(maybeType.value) !== elementKind) {
    return false;
  }
  line = trimLeftMemberAccess(line).remaining;
  const maybeAs = line.shift();
  line = trimLeftMemberAccess(line).remaining;
  if (line.length > 0 || (maybeAs && maybeAs.value.toLowerCase() !== 'as')) {
    return false;
  }

  return true;
}

// To determine if autocompletion should insert an additional space before
// inserting other tokens
export function shouldAppendSpace(token: SyntaxToken, offset: number): boolean {
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

export function trimLeftMemberAccess(stream: readonly Readonly<SyntaxToken>[]): {
  extracted: Readonly<SyntaxToken>[];
  remaining: Readonly<SyntaxToken>[];
} {
  const _stream = [...stream];

  const extracted: Readonly<SyntaxToken>[] = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const [fragment, maybeDot] = _stream;
    if (
      !fragment ||
      ![SyntaxTokenKind.QUOTED_STRING, SyntaxTokenKind.IDENTIFIER].includes(fragment.kind)
    ) {
      break;
    }
    extracted.push(_stream.shift()!);
    if (!isDot(maybeDot)) {
      break;
    }
    _stream.shift();
  }

  return {
    extracted,
    remaining: _stream,
  };
}

export function isDot(token?: SyntaxToken): boolean {
  return token?.kind === SyntaxTokenKind.OP && token?.value === '.';
}

export function getOffsetFromMonacoPosition(model: TextModel, position: Position): number {
  return model.getOffsetAt(position) - 1;
}
