import { Position } from '@/core/types';

export enum SyntaxTokenKind {
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

  TILDE = '<tilde>',

  SINGLE_LINE_COMMENT = '<single-line-comment>',
  MULTILINE_COMMENT = '<multiline-comment>',
}

export function isTriviaToken (token: SyntaxToken): boolean {
  switch (token.kind) {
    case SyntaxTokenKind.NEWLINE:
    case SyntaxTokenKind.SPACE:
    case SyntaxTokenKind.TAB:
    case SyntaxTokenKind.SINGLE_LINE_COMMENT:
    case SyntaxTokenKind.MULTILINE_COMMENT:
      return true;
    default:
      return false;
  }
}

export function isOp (c?: string): boolean {
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
    case '~':
      return true;
    default:
      return false;
  }
}

export function isOpToken (token?: SyntaxToken): boolean {
  return token !== undefined && token.kind === SyntaxTokenKind.OP;
}

export class SyntaxToken {
  kind: SyntaxTokenKind;

  value: string;

  leadingTrivia: SyntaxToken[];

  trailingTrivia: SyntaxToken[];

  leadingInvalid: SyntaxToken[];

  trailingInvalid: SyntaxToken[];

  startPos: Readonly<Position>;

  start: Readonly<number>;

  endPos: Readonly<Position>;

  end: Readonly<number>;

  isInvalid: boolean;

  protected constructor (
    kind: SyntaxTokenKind,
    startPos: Position,
    endPos: Position,
    value: string,
    isInvalid: boolean,
  ) {
    this.kind = kind;
    this.startPos = startPos;
    this.endPos = endPos;
    this.value = value;
    this.leadingTrivia = [];
    this.trailingTrivia = [];
    this.leadingInvalid = [];
    this.trailingInvalid = [];
    this.isInvalid = isInvalid;

    this.start = startPos.offset;
    this.end = endPos.offset;
  }

  static create (
    kind: SyntaxTokenKind,
    startPos: Position,
    endPos: Position,
    value: string,
    isInvalid: boolean,
  ) {
    return new SyntaxToken(kind, startPos, endPos, value, isInvalid);
  }
}
