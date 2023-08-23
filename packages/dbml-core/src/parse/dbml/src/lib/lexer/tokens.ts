import { Position } from '../types';

export enum SyntaxTokenKind {
  INVALID = '<invalid>',

  SPACE = '<space>',
  TAB = '<tab>',
  NEWLINE = '<newline>',

  COMMA = '<comma>',
  LPAREN = '<lparen>',
  RPAREN = '<rparen>',
  LBRACE = '<lbrace>',
  RBRACE = '<rbrace>',
  LBRACKET = '<lbracket>',
  RBRACKET = '<rbracket>',
  LANGLE = '<langle>',
  RANGLE = '<rangle>',

  OP = '<op>',
  EOF = '<eof>',
  NUMERIC_LITERAL = '<number>',
  STRING_LITERAL = '<string>',
  COLOR_LITERAL = '<color>',
  FUNCTION_EXPRESSION = '<function-expression>',

  QUOTED_STRING = '<variable>',
  IDENTIFIER = '<identifier>',

  SEMICOLON = '<semicolon>',
  COLON = '<colon>',

  SINGLE_LINE_COMMENT = '<single-line-comment>',
  MULTILINE_COMMENT = '<multiline-comment>',
}

export type SyntaxTriviaTokenKind =
  | SyntaxTokenKind.NEWLINE
  | SyntaxTokenKind.SPACE
  | SyntaxTokenKind.TAB
  | SyntaxTokenKind.SINGLE_LINE_COMMENT
  | SyntaxTokenKind.MULTILINE_COMMENT;

export function isTriviaToken(token: SyntaxToken): boolean {
  switch (token.kind) {
    case SyntaxTokenKind.NEWLINE:
    case SyntaxTokenKind.SPACE:
    case SyntaxTokenKind.TAB:
    case SyntaxTokenKind.SINGLE_LINE_COMMENT:
    case SyntaxTokenKind.MULTILINE_COMMENT:
    case SyntaxTokenKind.INVALID:
      return true;
    default:
      return false;
  }
}

export function isOp(c?: string): boolean {
  if (!c) {
    return false;
  }

  switch (c) {
    case '+':
    case '-':
    case '*':
    case '/':
    case '%':
    case '<':
    case '>':
    case '=':
    case '!':
    case '.':
    case '&':
    case '|':
      return true;
    default:
      return false;
  }
}

export function isOpToken(token?: SyntaxToken): boolean {
  return token !== undefined && token.kind === SyntaxTokenKind.OP;
}

export class SyntaxToken {
  kind: SyntaxTokenKind;

  value: string;

  leadingTrivia: SyntaxToken[];

  trailingTrivia: SyntaxToken[];

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  protected constructor(
    kind: SyntaxTokenKind,
    startPos: Position,
    endPos: Position,
    value: string,
  ) {
    this.kind = kind;
    this.startPos = startPos;
    this.endPos = endPos;
    this.value = value;
    this.leadingTrivia = [];
    this.trailingTrivia = [];

    this.start = startPos.offset;
    this.end = endPos.offset;
  }

  static create(kind: SyntaxTokenKind, startPos: Position, endPos: Position, value: string) {
    return new SyntaxToken(kind, startPos, endPos, value);
  }
}
