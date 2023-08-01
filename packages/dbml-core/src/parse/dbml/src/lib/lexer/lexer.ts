import { ParsingError, ParsingErrorCode } from '../errors';
import Result from '../result';
import { isAlpha, isAlphaNumeric, isDigit } from '../utils';
import { SyntaxToken, SyntaxTokenKind, isTriviaToken } from './tokens';

export default class Lexer {
  private start: number = 0;

  private current: number = 0;

  private text: string;

  private tokens: SyntaxToken[] = []; // list of lexed tokens, not including invalid tokens

  private errors: ParsingError[] = []; // list of errors during lexing

  constructor(text: string) {
    this.text = text;
  }

  private init() {
    this.start = 0;
    this.current = 0;
    this.tokens = [];
    this.errors = [];
  }

  private isAtEnd(): boolean {
    return this.current >= this.text.length;
  }

  private advance(): string {
    return this.text[this.current++];
  }

  private peek(lookahead: number = 0): string | undefined {
    if (this.current + lookahead >= this.text.length) {
      return undefined;
    }

    return this.text[this.current + lookahead];
  }

  private skip(step: number = 1) {
    this.current += step;
    this.start = this.current;
  }

  private closeGap() {
    this.start = this.current;
  }

  private addToken(kind: SyntaxTokenKind) {
    this.tokens.push(
      SyntaxToken.create(
        kind,
        this.start,
        this.current - this.start,
        this.text.substring(this.start, this.current),
      ),
    );
  }

  lex(): Result<SyntaxToken[]> {
    this.init();
    while (!this.isAtEnd()) {
      const c: string = this.peek()!;
      switch (c) {
        case ' ':
          this.advance();
          this.addToken(SyntaxTokenKind.SPACE);
          break;
        case '\r':
          this.advance();
          break;
        case '\n':
          this.advance();
          this.addToken(SyntaxTokenKind.NEWLINE);
          break;
        case '\t':
          this.advance();
          this.addToken(SyntaxTokenKind.TAB);
          break;
        case ',':
          this.advance();
          this.addToken(SyntaxTokenKind.COMMA);
          break;
        case '.':
          this.advance();
          this.addToken(SyntaxTokenKind.DOT);
          break;
        case '/':
          if (this.peek(1) === '/') {
            this.singleLineComment();
          } else if (this.peek(1) === '*') {
            this.multilineComment();
          } else {
            this.advance();
            this.addToken(SyntaxTokenKind.FORWARDSLASH);
          }
          break;
        case '%':
          this.advance();
          this.addToken(SyntaxTokenKind.PERCENT);
          break;
        case '*':
          this.advance();
          this.addToken(SyntaxTokenKind.ASTERISK);
          break;
        case '+':
          this.advance();
          this.addToken(SyntaxTokenKind.CROSS);
          break;
        case '-':
          this.advance();
          this.addToken(SyntaxTokenKind.MINUS);
          break;
        case '(':
          this.advance();
          this.addToken(SyntaxTokenKind.LPAREN);
          break;
        case ')':
          this.advance();
          this.addToken(SyntaxTokenKind.RPAREN);
          break;
        case '[':
          this.advance();
          this.addToken(SyntaxTokenKind.LBRACKET);
          break;
        case ']':
          this.advance();
          this.addToken(SyntaxTokenKind.RBRACKET);
          break;
        case '{':
          this.advance();
          this.addToken(SyntaxTokenKind.LBRACE);
          break;
        case '}':
          this.advance();
          this.addToken(SyntaxTokenKind.RBRACE);
          break;
        case ';':
          this.advance();
          this.addToken(SyntaxTokenKind.SEMICOLON);
          break;
        case ':':
          this.advance();
          this.addToken(SyntaxTokenKind.COLON);
          break;
        case '<':
          this.advance();
          if (this.peek() !== '=') {
            this.addToken(SyntaxTokenKind.LT);
          } else {
            this.advance();
            this.addToken(SyntaxTokenKind.LE);
          }
          break;
        case '>':
          this.advance();
          if (this.peek() !== '=') {
            this.addToken(SyntaxTokenKind.GT);
          } else {
            this.advance();
            this.addToken(SyntaxTokenKind.GE);
          }
          break;
        case '=':
          this.advance();
          if (this.peek() !== '=') {
            this.addToken(SyntaxTokenKind.EQUAL);
          } else {
            this.advance();
            this.addToken(SyntaxTokenKind.DOUBLE_EQUAL);
          }
          break;
        case '!':
          this.advance();
          if (this.peek() !== '=') {
            this.addToken(SyntaxTokenKind.EXCLAMATION);
          } else {
            this.advance();
            this.addToken(SyntaxTokenKind.NOT_EQUAL);
          }
          break;
        case "'":
          if (this.checkTripleQuote()) {
            this.multilineStringLiteral();
          } else {
            this.singleLineStringLiteral();
          }
          break;
        case '"':
          this.quotedVariable();
          break;
        case '`':
          this.functionExpression();
          break;
        case '#':
          this.colorLiteral();
          break;
        default:
          if (isAlpha(c)) {
            this.identifier();
            break;
          } else if (isDigit(c)) {
            this.numericLiteral();
            break;
          } else {
            this.advance();
            this.errors.push(
              new ParsingError(
                ParsingErrorCode.EXPECTED_THINGS,
                `Unexpected token ${c}`,
                this.start,
                this.current - 1,
              ),
            );
            break;
          }
      }
      this.closeGap();
    }
    this.tokens.push(SyntaxToken.create(SyntaxTokenKind.EOF, this.start, 0));
    this.gatherTrivia();

    return new Result(this.tokens, this.errors);
  }

  gatherTrivia() {
    let startOfLine = true;
    let triviaList: SyntaxToken[] = [];
    let lastNonTrivia: SyntaxToken | undefined;
    const newTokenList: SyntaxToken[] = [];
    // eslint-disable-next-line no-restricted-syntax
    for (const token of this.tokens) {
      if (isTriviaToken(token)) {
        triviaList.push(token);
        if (token.kind === SyntaxTokenKind.NEWLINE) {
          if (lastNonTrivia) {
            lastNonTrivia.trailingTrivia = triviaList;
            startOfLine = true;
            lastNonTrivia = undefined;
            triviaList = [];
          }
        }
        continue;
      }
      if (startOfLine) {
        token.leadingTrivia = triviaList;
        newTokenList.push(token);
        triviaList = [];
        lastNonTrivia = token;
        startOfLine = false;
      } else {
        lastNonTrivia!.trailingTrivia = triviaList;
        newTokenList.push(token);
        triviaList = [];
        lastNonTrivia = token;
      }
    }
    this.tokens = newTokenList;
  }

  checkTripleQuote() {
    return this.peek(0) === "'" && this.peek(1) === "'" && this.peek(2) === "'";
  }

  singleLineStringLiteral() {
    this.skip();
    let string = '';
    while (!this.isAtEnd() && !(this.peek() === '\n') && !(this.peek() === "'")) {
      if (this.peek() === '\\') {
        string += this.escapedString();
      } else {
        string += this.advance();
      }
    }

    if (this.isAtEnd() || this.peek() === '\n') {
      this.errors.push(
        new ParsingError(
          ParsingErrorCode.INVALID,
          'Unclosed single-line string literal',
          this.start - 1,
          this.current,
        ),
      );
    } else {
      this.tokens.push(
        SyntaxToken.create(
          SyntaxTokenKind.STRING_LITERAL,
          this.start - 1,
          this.current - this.start + 2,
          string,
        ),
      );
      this.advance();
    }
  }

  multilineStringLiteral() {
    this.skip(3);
    let string = '';
    while (!this.isAtEnd() && !this.checkTripleQuote()) {
      if (this.peek() === '\\') {
        string += this.escapedString();
      } else {
        string += this.advance();
      }
    }

    if (this.isAtEnd()) {
      this.errors.push(
        new ParsingError(
          ParsingErrorCode.INVALID,
          'Unclosed multiline string literal',
          this.start - 3,
          this.current,
        ),
      );
    } else {
      this.tokens.push(
        SyntaxToken.create(
          SyntaxTokenKind.STRING_LITERAL,
          this.start - 3,
          this.current - this.start + 6,
          string,
        ),
      );
      this.skip(3);
    }
  }

  functionExpression() {
    this.skip();
    let string = '';
    while (!this.isAtEnd() && !(this.peek() === '\n') && !(this.peek() === '`')) {
      if (this.peek() === '\\') {
        string += this.escapedString();
      } else {
        string += this.advance();
      }
    }

    if (this.isAtEnd() || this.peek() === '\n') {
      this.errors.push(
        new ParsingError(
          ParsingErrorCode.INVALID,
          'Unclosed function expression',
          this.start - 1,
          this.current,
        ),
      );
    } else {
      this.tokens.push(
        SyntaxToken.create(
          SyntaxTokenKind.FUNCTION_EXPRESSION,
          this.start - 1,
          this.current - this.start + 2,
          string,
        ),
      );
      this.advance();
    }
  }

  quotedVariable() {
    this.skip();
    let string = '';
    while (!this.isAtEnd() && !(this.peek() === '\n') && !(this.peek() === '"')) {
      if (this.peek() === '\\') {
        string += this.escapedString();
      } else {
        string += this.advance();
      }
    }

    if (this.isAtEnd() || this.peek() === '\n') {
      this.errors.push(
        new ParsingError(
          ParsingErrorCode.INVALID,
          'Unclosed quoted variable',
          this.start - 1,
          this.current,
        ),
      );
    } else {
      this.tokens.push(
        SyntaxToken.create(
          SyntaxTokenKind.QUOTED_STRING,
          this.start - 1,
          this.current - this.start + 2,
          string,
        ),
      );
      this.advance();
    }
  }

  identifier() {
    const first = this.peek();
    if (!first || !isAlpha(first)) {
      return;
    }
    this.advance();
    let c = this.peek();
    while (c && isAlphaNumeric(c)) {
      this.advance();
      c = this.peek();
    }
    this.addToken(SyntaxTokenKind.IDENTIFIER);
  }

  numericLiteral() {
    let isFloat = false;
    const first = this.peek();
    if (!first || !isDigit(first)) {
      return;
    }
    this.advance();
    let c = this.peek();
    while (c && (isDigit(c) || c === '.')) {
      if (c === '.') {
        if (isFloat) {
          break;
        }
        isFloat = true;
      }
      this.advance();
      c = this.peek();
    }

    if (c && (isAlpha(c) || c === '.')) {
      while (c && (isAlphaNumeric(c) || c === '.')) {
        this.advance();
        c = this.peek();
      }
      this.errors.push(
        new ParsingError(ParsingErrorCode.INVALID, 'Invalid number', this.start, this.current),
      );
    } else {
      this.addToken(SyntaxTokenKind.NUMERIC_LITERAL);
    }
  }

  colorLiteral() {
    const first = this.peek();
    if (first !== '#') {
      return;
    }
    this.advance();
    let c = this.peek();
    while (c && isAlphaNumeric(c)) {
      this.advance();
      c = this.peek();
    }
    this.addToken(SyntaxTokenKind.COLOR_LITERAL);
  }

  singleLineComment() {
    this.skip(2);
    while (!this.isAtEnd() && this.peek() !== '\n') {
      this.advance();
    }
    this.tokens.push(
      SyntaxToken.create(
        SyntaxTokenKind.SINGLE_LINE_COMMENT,
        this.start - 2,
        this.current - this.start + 2,
        this.text.substring(this.start, this.current),
      ),
    );
  }

  multilineComment() {
    this.skip(2);
    while (!this.isAtEnd() && (this.peek() !== '*' || this.peek(1) !== '/')) {
      this.advance();
    }
    if (this.isAtEnd()) {
      this.tokens.push(
        SyntaxToken.create(
          SyntaxTokenKind.INVALID,
          this.start - 2,
          this.current - this.start + 2,
          this.text.substring(this.start, this.current),
        ),
      );
    } else {
      this.tokens.push(
        SyntaxToken.create(
          SyntaxTokenKind.MULTILINE_COMMENT,
          this.start - 2,
          this.current - this.start + 4,
          this.text.substring(this.start, this.current),
        ),
      );
      this.skip(2);
    }
  }

  escapedString(): string {
    this.skip();
    let char = '';
    switch (this.peek()) {
      case 't':
        char = '\t';
        this.advance();
        break;
      case 'n':
        char = '\n';
        this.advance();
        break;
      case '\\':
        char = '\\';
        this.advance();
        break;
      case 'r':
        char = '\r';
        this.advance();
        break;
      case "'":
        char = "'";
        this.advance();
        break;
      case '"':
        char = '"';
        this.advance();
        break;
      case '0':
        char = '\0';
        this.advance();
        break;
      case 'b':
        char = '\b';
        this.advance();
        break;
      case 'v':
        char = '\v';
        this.advance();
        break;
      case 'f':
        char = 'f';
        this.advance();
        break;
      case 'u': {
        let hex = '';
        for (let i = 0; i <= 3; i += 1) {
          if (this.peek() && isAlphaNumeric(this.peek()!)) {
            hex += this.advance();
            char = String.fromCharCode(parseInt(hex, 16));
          } else {
            char = `\\u${hex}`;
          }
        }
        break;
      }
      default:
        char = `\\${this.peek()}`;
        this.advance();
        break;
    }

    return char;
  }
}
