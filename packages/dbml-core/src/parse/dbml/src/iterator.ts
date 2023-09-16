import { SyntaxNodeKind } from './lib/parser/nodes';
import Compiler from './compiler';
import { SyntaxToken, SyntaxTokenKind } from './lib/lexer/tokens';
import { hasTrailingNewLines } from './lib/lexer/utils';
import { None, Option, Some } from './lib/option';

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
    for (start = id - 1; start >= -1; start -= 1) {
      if (start === -1 || isAtEndOfLogicalLine(compiler, flatStream[start])) {
        start += 1;
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
// e.g id integer [
//  ...
// ] <end-of-logical-line>
function isAtEndOfLogicalLine(compiler: Compiler, token: SyntaxToken): boolean {
  const containers = compiler.containers(token.start);
  const isWithinNodeOfKind = (kinds: SyntaxNodeKind[]): boolean =>
    containers.find((c) => kinds.includes(c.kind)) !== undefined;

  return (
    // There must be newlines after this token
    hasTrailingNewLines(token) &&
    // This token must not be of kinds that allow a logical line
    // to span more than one physical lines
    // e.g `.`, `,` are disallowed
    ([
      SyntaxTokenKind.QUOTED_STRING,
      SyntaxTokenKind.STRING_LITERAL,
      SyntaxTokenKind.NUMERIC_LITERAL,
      SyntaxTokenKind.MULTILINE_COMMENT,
      SyntaxTokenKind.SINGLE_LINE_COMMENT,
      SyntaxTokenKind.COLOR_LITERAL,
      SyntaxTokenKind.IDENTIFIER,
      SyntaxTokenKind.LBRACE,
      SyntaxTokenKind.RBRACE,
    ].includes(token.kind) ||
      // Or this token must not be within a context that can span multiple physical lines
      // e.g [...] (...) are disallowed while { ... } is okay
      (isWithinNodeOfKind([SyntaxNodeKind.LIST_EXPRESSION]) &&
        token.kind === SyntaxTokenKind.RBRACKET) ||
      (isWithinNodeOfKind([SyntaxNodeKind.GROUP_EXPRESSION, SyntaxNodeKind.TUPLE_EXPRESSION]) &&
        token.kind === SyntaxTokenKind.RPAREN))
  );
}
