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

  DOT = '<dot>',
  EOF = '<eof>',
  NUMERIC_LITERAL = '<number>',
  STRING_LITERAL = '<string>',
  COLOR_LITERAL = '<color>',
  FUNCTION_EXPRESSION = '<function-expression>',

  QUOTED_STRING = '<variable>',
  IDENTIFIER = '<identifier>',

  ASTERISK = '<asterisk>',
  CROSS = '<cross>',
  MINUS = '<minus>',
  BACKSLASH = '<backslash>',
  FORWARDSLASH = '<forwardslash>',
  PERCENT = '<percent>',
  EXCLAMATION = '<exclamation>',
  EQUAL = '<equal>',
  DOUBLE_EQUAL = '<double-equal>',
  NOT_EQUAL = '<not-equal>',
  LT = '<lt>',
  LE = '<le>',
  GT = '<gt>',
  GE = '<ge>',
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
      return true;
    default:
      return false;
  }
}

export function isOpToken(token?: SyntaxToken): boolean {
  if (!token) {
    return false;
  }

  switch (token.kind) {
    case SyntaxTokenKind.CROSS:
    case SyntaxTokenKind.ASTERISK:
    case SyntaxTokenKind.MINUS:
    case SyntaxTokenKind.FORWARDSLASH:
    case SyntaxTokenKind.PERCENT:
    case SyntaxTokenKind.LT:
    case SyntaxTokenKind.LE:
    case SyntaxTokenKind.GT:
    case SyntaxTokenKind.GE:
    case SyntaxTokenKind.EQUAL:
    case SyntaxTokenKind.DOUBLE_EQUAL:
    case SyntaxTokenKind.NOT_EQUAL:
    case SyntaxTokenKind.EXCLAMATION:
    case SyntaxTokenKind.DOT:
    case SyntaxTokenKind.LPAREN:
      return true;
    default:
      return false;
  }
}

export class SyntaxToken {
  kind: SyntaxTokenKind;

  value?: unknown;

  leadingTrivia: SyntaxToken[];

  trailingTrivia: SyntaxToken[];

  offset: number;

  length: number;

  protected constructor(kind: SyntaxTokenKind, offset: number, length: number, value?: unknown) {
    this.kind = kind;
    this.offset = offset;
    this.value = value;
    this.length = length;
    this.leadingTrivia = [];
    this.trailingTrivia = [];
  }

  static create(kind: SyntaxTokenKind, offset: number, length: number, value?: unknown) {
    return new SyntaxToken(kind, offset, length, value);
  }
}
