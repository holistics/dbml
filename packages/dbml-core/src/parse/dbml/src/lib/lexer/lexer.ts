import { ParsingError, ParsingErrorCode } from '../errors';
import Result from '../result';
import { isAlpha, isAlphaNumeric, isDigit } from '../utils';
import {
 SyntaxToken, SyntaxTokenKind, isOp, isTriviaToken,
} from './tokens';

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
    this.scanTokens();
    this.tokens.push(SyntaxToken.create(SyntaxTokenKind.EOF, this.start, 0));
    this.gatherTrivia();

    return new Result(this.tokens, this.errors);
  }

  scanTokens() {
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
        case '/':
          if (this.peek(1) === '/') {
            this.singleLineComment();
          } else if (this.peek(1) === '*') {
            this.multilineComment();
          } else {
            this.operator();
          }
          break;
        default:
          if (isOp(c)) {
            this.operator();
            break;
          }
          if (isAlpha(c)) {
            this.identifier();
            break;
          }
          if (isDigit(c)) {
            this.numericLiteral();
            break;
          }
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
      this.start = this.current;
    }
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
        // If a newline token is encountered
        if (token.kind === SyntaxTokenKind.NEWLINE) {
          // If there are any non-trivias in the line,
          // then `triviaList` belongs to its `trailingTrivia`
          if (lastNonTrivia) {
            lastNonTrivia.trailingTrivia = triviaList;
            startOfLine = true;
            lastNonTrivia = undefined;
            // Clear the trivia list
            triviaList = [];
          }
          // Otherwise, the line is empty, the `triviaList` is kept to the next line
        }
        continue;
      }
      // If at start of line and the first non-trivia is encountered,
      // then `triviaList` belongs to that non-trivia as `leadingTrivia`
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

  // Check if the sequence ahead matches the passed-in sequence
  checkSequenceAhead(sequence: string): boolean {
    for (let i = 0; i < sequence.length; ++i) {
      if (sequence[i] !== this.peek(i)) {
        return false;
      }
    }

    return true;
  }

  // Extract a string-like token between `openSequence` and `closeSequence`
  // For example, for string-literal, `openSequence` and `closeSequence` could be "'''"
  // `invalidChar` is a list of not-allowed-to-appear characters in the string
  // `allowEndingEof` indicates whether the string could end with `eof`
  // `isRawString` indicates whether there can be escaped sequences
  extractString(
    openSequence: string,
    closeSequence: string,
    invalidChar: string[],
    allowEndingEof: boolean,
    isRawString: boolean,
    stringKind: SyntaxTokenKind,
  ) {
    if (!this.checkSequenceAhead(openSequence)) {
      return;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const _ of openSequence) {
      this.advance();
    }

    let string = '';

    while (
      !this.isAtEnd() &&
      !invalidChar.includes(this.peek()!) &&
      !this.checkSequenceAhead(closeSequence)
    ) {
      if (this.peek() === '\\' && !isRawString) {
        string += this.escapedString();
      } else {
        string += this.advance();
      }
    }

    if (this.isAtEnd() && !allowEndingEof) {
      this.errors.push(
        new ParsingError(
          ParsingErrorCode.INVALID,
          'Eof reached while parsing',
          this.start,
          this.current,
        ),
      );

      return;
    }

    if (!this.isAtEnd() && invalidChar.includes(this.peek()!)) {
      this.errors.push(
        new ParsingError(
          ParsingErrorCode.INVALID,
          `Invalid ${this.peek() === '\n' ? 'newline' : 'character'} encountered while parsing`,
          this.start,
          this.current,
        ),
      );

      return;
    }

    this.tokens.push(
      SyntaxToken.create(
        stringKind,
        this.start,
        string.length + openSequence.length + closeSequence.length,
        string,
      ),
    );

    // eslint-disable-next-line no-restricted-syntax
    for (const _ of closeSequence) {
      this.advance();
    }
  }

  singleLineStringLiteral() {
    this.extractString("'", "'", ['\n'], false, false, SyntaxTokenKind.STRING_LITERAL);
  }

  multilineStringLiteral() {
    this.extractString("'''", "'''", [], false, false, SyntaxTokenKind.STRING_LITERAL);
  }

  functionExpression() {
    this.extractString('`', '`', ['\n'], false, false, SyntaxTokenKind.FUNCTION_EXPRESSION);
  }

  quotedVariable() {
    this.extractString('"', '"', ['\n'], false, false, SyntaxTokenKind.QUOTED_STRING);
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

  operator() {
    if (!isOp(this.peek())) {
      return;
    }

    while (isOp(this.peek())) {
      this.advance();
    }
    this.addToken(SyntaxTokenKind.OP);
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
    this.extractString('//', '\n', [], true, true, SyntaxTokenKind.SINGLE_LINE_COMMENT);
  }

  multilineComment() {
    this.extractString('/*', '*/', [], false, true, SyntaxTokenKind.MULTILINE_COMMENT);
  }

  escapedString(): string {
    this.advance();
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
          } else {
            return `\\u${hex}`;
          }
        }

        return String.fromCharCode(parseInt(hex, 16));
      }
      default:
        char = `\\${this.peek()}`;
        this.advance();
        break;
    }

    return char;
  }
}
