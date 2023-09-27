import * as monaco from 'monaco-editor-core';
import { SymbolKind } from '../../lib/analyzer/symbol/symbolIndex';
import {
 CompletionItemKind, CompletionList, Position, TextModel,
} from '../types';
import { ElementKind } from '../../lib/analyzer/validator/types';
import { SyntaxToken, SyntaxTokenKind } from '../../lib/lexer/tokens';
import { toElementKind } from '../../lib/analyzer/validator/utils';
import { hasTrailingNewLines, hasTrailingSpaces, isAtStartOfLine } from '../../lib/lexer/utils';
import { SyntaxNode, SyntaxNodeKind } from '../../lib/parser/nodes';
import { None, Option, Some } from '../../lib/option';
import Compiler, { ScopeKind } from '../../compiler';

/* eslint-disable @typescript-eslint/no-redeclare,no-import-assign */
const { CompletionItemKind, CompletionItemInsertTextRule } = monaco.languages;
/* eslint-enable @typescript-eslint/no-redeclare,no-import-assign */

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

export function isPrecedingLineJoiningToken(token: SyntaxToken): boolean {
  return [SyntaxTokenKind.COLON, SyntaxTokenKind.OP, SyntaxTokenKind.COMMA].includes(token.kind);
}

export function isFollowingLineJoiningToken(token: SyntaxToken): boolean {
  return [
    SyntaxTokenKind.COLON,
    SyntaxTokenKind.LBRACKET,
    SyntaxTokenKind.LPAREN,
    SyntaxTokenKind.OP,
  ].includes(token.kind);
}

export function isInNewlineInsensitiveContext(
  containerNode: SyntaxNode,
  token: SyntaxToken,
): boolean {
  switch (containerNode.kind) {
    case SyntaxNodeKind.LIST_EXPRESSION:
      return token.kind !== SyntaxTokenKind.RBRACKET;
    case SyntaxNodeKind.TUPLE_EXPRESSION:
    case SyntaxNodeKind.GROUP_EXPRESSION:
      return token.kind !== SyntaxTokenKind.RPAREN;
    default:
      return false;
  }
}

export class TokenIterator {
  private readonly tokens: readonly Readonly<SyntaxToken>[];
  private readonly id: number;

  protected constructor(tokens: readonly SyntaxToken[], id: number) {
    this.tokens = tokens;
    this.id = id;
  }

  back(): TokenIterator {
    return new TokenIterator(this.tokens, this.id - 1);
  }

  next(): TokenIterator {
    return new TokenIterator(this.tokens, this.id + 1);
  }

  value(): Option<Readonly<SyntaxToken>> {
    return this.isOutOfBound() ? new None() : new Some(this.tokens[this.id]);
  }

  isOutOfBound(): boolean {
    return this.id < 0 || this.id >= this.tokens.length;
  }

  collectAll(): Option<Readonly<SyntaxToken>[]> {
    return this.isOutOfBound() ? new None() : new Some([...this.tokens]);
  }

  collectFromStart(): Option<Readonly<SyntaxToken>[]> {
    return this.isOutOfBound() ? new None() : new Some(this.tokens.slice(0, this.id + 1));
  }

  isAtStart(): boolean {
    return this.id === 0;
  }

  isAtEnd(): boolean {
    return this.id === this.tokens.length - 1;
  }
}

export class TokenLogicalLineIterator extends TokenIterator {
  static fromOffset(compiler: Compiler, offset: number): TokenLogicalLineIterator {
    const flatStream = compiler.token.flatStream();
    const id = compiler.token.nonTrivial.beforeOrContainOnSameLine(offset).unwrap_or(-1);

    if (id === -1) {
      return new TokenLogicalLineIterator([], -1);
    }

    let start: number | undefined;
    let end: number | undefined;
    for (start = id; start >= 1; start -= 1) {
      const token = flatStream[start];
      const prevToken = start === 0 ? undefined : flatStream[start - 1];
      const containers = compiler.containers(token.start);
      if (isAtStartOfLogicalLine(containers, token, prevToken)) {
        break;
      }
    }

    for (end = id; end < compiler.token.flatStream().length; end += 1) {
      if (hasTrailingNewLines(compiler.token.flatStream()[end])) {
        break;
      }
    }

    return new TokenLogicalLineIterator(
      compiler.token.flatStream().slice(start, end + 1),
      id - start,
    );
  }
}

export class TokenSourceIterator extends TokenIterator {
  static fromOffset(compiler: Compiler, offset: number): TokenIterator {
    const id = compiler.token.nonTrivial.beforeOrContain(offset).unwrap_or(-1);

    return new TokenIterator(compiler.token.flatStream(), id);
  }
}

// A logical line is different from a physical line in that
// a logical line can span multiple physical lines
function isAtStartOfLogicalLine(
  containers: readonly Readonly<SyntaxNode>[],
  token: SyntaxToken,
  prevToken?: SyntaxToken,
): boolean {
  if (!prevToken) {
    return true;
  }

  if (isAtStartOfLine(prevToken, token)) {
    if (containers.some((node) => isInNewlineInsensitiveContext(node, prevToken))) {
      return false;
    }
    if (!isPrecedingLineJoiningToken(token)) {
      return true;
    }
  }

  if (hasTrailingNewLines(prevToken)) {
    if (!isFollowingLineJoiningToken(prevToken)) {
      return true;
    }
  }

  return false;
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

export function addQuoteIfContainSpace(completionList: CompletionList): CompletionList {
  return {
    ...completionList,
    suggestions: completionList.suggestions.map((s) => ({
      ...s,
      insertText: s.insertText.search(' ') !== -1 ? `"${s.insertText}"` : s.insertText,
    })),
  };
}
