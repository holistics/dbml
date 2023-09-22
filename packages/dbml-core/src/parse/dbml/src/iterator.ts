import { SyntaxNode, SyntaxNodeKind } from './lib/parser/nodes';
import Compiler from './compiler';
import { SyntaxToken, SyntaxTokenKind } from './lib/lexer/tokens';
import { hasTrailingNewLines, isAtStartOfLine } from './lib/lexer/utils';
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
    for (start = id; start >= 1; start -= 1) {
      const token = flatStream[start];
      const prevToken = start === 0 ? undefined : flatStream[start - 1];
      const containers = compiler.containers(token.start);
      if (
        isAtStartOfLogicalLine(containers, token, prevToken)
      ) {
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

  if (containers.some((node) => isInNewlineInsensitiveContext(node, prevToken))) {
    return true;
  }

  let startRes = false;
  if (isAtStartOfLine(prevToken, token)) {
    startRes = !isPrecedingLineJoiningToken(token);
  }

  let endRes = false;
  if (hasTrailingNewLines(prevToken)) {
    endRes = !isFollowingLineJoiningToken(prevToken);
  }

  return startRes || endRes;
}

function isPrecedingLineJoiningToken(token: SyntaxToken): boolean {
  return [SyntaxTokenKind.COLON, SyntaxTokenKind.OP, SyntaxTokenKind.COMMA].includes(token.kind);
}

function isFollowingLineJoiningToken(token: SyntaxToken): boolean {
  return [
    SyntaxTokenKind.COLON,
    SyntaxTokenKind.LBRACKET,
    SyntaxTokenKind.LPAREN,
    SyntaxTokenKind.OP,
  ].includes(token.kind);
}

function isInNewlineInsensitiveContext(containerNode: SyntaxNode, token: SyntaxToken): boolean {
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
