import { CompileError, CompileErrorCode } from '../errors';
import Report from '../report';
import { isAlphaOrUnderscore, isAlphaNumeric, isDigit } from '../utils';
import {
 SyntaxToken, SyntaxTokenKind, isOp, isTriviaToken,
} from './tokens';
import { Position } from '../types';

export default class Lexer {
  private start: Position = {
    offset: 0,
    line: 0,
    column: 0,
  };

  private current: Position = {
    offset: 0,
    line: 0,
    column: 0,
  };

  private text: string;

  private tokens: SyntaxToken[] = []; // list of lexed tokens, not including invalid tokens

  private errors: CompileError[] = []; // list of errors during lexing

  constructor(text: string) {
    this.text = text;
  }

  private isAtEnd(): boolean {
    return this.current.offset >= this.text.length;
  }

  private advance(): string {
    const c = this.peek();
    this.current = { ...this.current };
    if (c === '\n') {
      this.current.line += 1;
      this.current.column = 0;
    } else {
      this.current.column += 1;
    }
    this.current.offset += 1;

    return c!;
  }

  private peek(lookahead: number = 0): string | undefined {
    if (this.current.offset + lookahead >= this.text.length) {
      return undefined;
    }

    return this.text[this.current.offset + lookahead];
  }

  // Check if the sequence ahead matches `sequence`
  check(sequence: string): boolean {
    for (let i = 0; i < sequence.length; i += 1) {
      if (sequence[i] !== this.peek(i)) {
        return false;
      }
    }

    return true;
  }

  // If the sequence ahead matches `sequence`, move `current` past `sequence`
  match(sequence: string): boolean {
    if (!this.check(sequence)) {
      return false;
    }

    // eslint-disable-next-line no-restricted-syntax
    for (const _ of sequence) {
      this.advance();
    }

    return true;
  }

  private addToken(kind: SyntaxTokenKind) {
    this.tokens.push(this.createToken(kind));
  }

  private createToken(kind: SyntaxTokenKind): SyntaxToken {
    return SyntaxToken.create(
      kind,
      this.start,
      this.current,
      this.text.substring(this.start.offset, this.current.offset),
    );
  }

  lex(): Report<SyntaxToken[], CompileError> {
    this.scanTokens();
    this.tokens.push(SyntaxToken.create(SyntaxTokenKind.EOF, this.start, this.current, ''));
    this.gatherTrivia();

    return new Report(this.tokens, this.errors);
  }

  scanTokens() {
    while (!this.isAtEnd()) {
      const c = this.advance();
      switch (c) {
        case ' ':
          this.addToken(SyntaxTokenKind.SPACE);
          break;
        case '\r':
          break;
        case '\n':
          this.addToken(SyntaxTokenKind.NEWLINE);
          break;
        case '\t':
          this.addToken(SyntaxTokenKind.TAB);
          break;
        case ',':
          this.addToken(SyntaxTokenKind.COMMA);
          break;
        case '(':
          this.addToken(SyntaxTokenKind.LPAREN);
          break;
        case ')':
          this.addToken(SyntaxTokenKind.RPAREN);
          break;
        case '[':
          this.addToken(SyntaxTokenKind.LBRACKET);
          break;
        case ']':
          this.addToken(SyntaxTokenKind.RBRACKET);
          break;
        case '{':
          this.addToken(SyntaxTokenKind.LBRACE);
          break;
        case '}':
          this.addToken(SyntaxTokenKind.RBRACE);
          break;
        case ';':
          this.addToken(SyntaxTokenKind.SEMICOLON);
          break;
        case ':':
          this.addToken(SyntaxTokenKind.COLON);
          break;
        case "'":
          if (this.match("''")) {
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
          if (this.match('/')) {
            this.singleLineComment();
          } else if (this.match('*')) {
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
          if (isAlphaOrUnderscore(c)) {
            this.identifier();
            break;
          }
          if (isDigit(c)) {
            this.numericLiteral();
            break;
          }
          this.addToken(SyntaxTokenKind.INVALID);
          this.errors.push(
            new CompileError(
              CompileErrorCode.UNKNOWN_SYMBOL,
              `Unexpected token '${c}'`,
              this.createToken(SyntaxTokenKind.INVALID),
            ),
          );
          break;
      }
      this.start = { ...this.current };
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
        // If a newline token is encountered and there are any non-trivias in the line,
        // then `triviaList` belongs to its `trailingTrivia`
        if (token.kind === SyntaxTokenKind.NEWLINE && lastNonTrivia) {
          lastNonTrivia.trailingTrivia = triviaList;
          startOfLine = true;
          lastNonTrivia = undefined;
          triviaList = [];
        }
      } else {
        // The first non-trivia is encountered

        // If at start of line
        // then `triviaList` belongs to that non-trivia as `leadingTrivia`
        // eslint-disable-next-line no-unused-expressions
        startOfLine ?
          (token.leadingTrivia = triviaList) :
          (lastNonTrivia!.trailingTrivia = triviaList);
        newTokenList.push(token);
        triviaList = [];
        lastNonTrivia = token;
        startOfLine = false;
      }
    }

    this.tokens = newTokenList;
  }

  // Consuming characters until the `stopSequence` is encountered
  consumeUntil(
    tokenKind: SyntaxTokenKind,
    stopSequence: string,
    {
      allowNewline, // Whether newline is allowed
      allowEof, // Whether EOF is allowed
      raw, // Whether to interpret '\' as a backlash
    }: { allowNewline: boolean; allowEof: boolean; raw: boolean },
  ) {
    let string = '';

    while (!this.isAtEnd() && (allowNewline || !this.check('\n')) && !this.check(stopSequence)) {
      if (this.peek() === '\\' && !raw) {
        this.advance();
        string += this.escapedString();
      } else {
        string += this.advance();
      }
    }

    if (this.isAtEnd() && !allowEof) {
      const token = this.createToken(SyntaxTokenKind.INVALID);
      this.tokens.push(token);
      this.errors.push(
        new CompileError(CompileErrorCode.UNEXPECTED_EOF, 'EOF reached while parsing', token),
      );

      return;
    }

    if (this.check('\n') && !allowNewline) {
      const token = this.createToken(SyntaxTokenKind.INVALID);
      this.tokens.push(token);
      this.errors.push(
        new CompileError(
          CompileErrorCode.UNEXPECTED_NEWLINE,
          'Invalid newline encountered while parsing',
          token,
        ),
      );

      return;
    }

    this.match(stopSequence);
    this.tokens.push(SyntaxToken.create(tokenKind, this.start, this.current, string));
  }

  singleLineStringLiteral() {
    this.consumeUntil(SyntaxTokenKind.STRING_LITERAL, "'", {
      allowNewline: false,
      allowEof: false,
      raw: false,
    });
  }

  multilineStringLiteral() {
    this.consumeUntil(SyntaxTokenKind.STRING_LITERAL, "'''", {
      allowNewline: true,
      allowEof: false,
      raw: false,
    });
  }

  functionExpression() {
    this.consumeUntil(SyntaxTokenKind.FUNCTION_EXPRESSION, '`', {
      allowNewline: false,
      allowEof: false,
      raw: true,
    });
  }

  quotedVariable() {
    this.consumeUntil(SyntaxTokenKind.QUOTED_STRING, '"', {
      allowNewline: false,
      allowEof: false,
      raw: false,
    });
  }

  singleLineComment() {
    this.consumeUntil(SyntaxTokenKind.SINGLE_LINE_COMMENT, '\n', {
      allowNewline: true,
      allowEof: true,
      raw: true,
    });
  }

  multilineComment() {
    this.consumeUntil(SyntaxTokenKind.MULTILINE_COMMENT, '*/', {
      allowNewline: true,
      allowEof: false,
      raw: true,
    });
  }

  identifier() {
    while (!this.isAtEnd() && isAlphaNumeric(this.peek()!)) {
      this.advance();
    }
    this.addToken(SyntaxTokenKind.IDENTIFIER);
  }

  operator() {
    while (isOp(this.peek())) {
      this.advance();
    }
    this.addToken(SyntaxTokenKind.OP);
  }

  numericLiteral() {
    let nDots = 0;
    while (!this.isAtEnd()) {
      const isDot = this.check('.');
      nDots += isDot ? 1 : 0;
      if (nDots > 1) {
        break;
      }

      // The first way to return a numeric literal without error:
      // a digit is encountered as the last character
      if (!isDot && this.current.offset === this.tokens.length - 1) {
        this.advance();

        return this.addToken(SyntaxTokenKind.NUMERIC_LITERAL);
      }

      // The second way to return a numeric literal without error:
      // a non alpha-numeric and non-dot character is encountered
      if (!isDot && !isAlphaNumeric(this.peek()!)) {
        return this.addToken(SyntaxTokenKind.NUMERIC_LITERAL);
      }

      if (!isDot && !isDigit(this.peek()!)) {
        break;
      }

      this.advance();
    }
    // if control reaches here, an invalid number has been encountered
    // consume all alphanumeric characters or . of the invalid number
    while (!this.isAtEnd() && (this.check('.') || isAlphaNumeric(this.peek()!))) {
      this.advance();
    }

    const token = this.createToken(SyntaxTokenKind.INVALID);
    this.tokens.push(token);
    this.errors.push(new CompileError(CompileErrorCode.UNKNOWN_TOKEN, 'Invalid number', token));
  }

  colorLiteral() {
    while (!this.isAtEnd() && isAlphaNumeric(this.peek()!)) {
      this.advance();
    }
    this.addToken(SyntaxTokenKind.COLOR_LITERAL);
  }

  escapedString(): string {
    if (this.isAtEnd()) {
      return '\\';
    }
    switch (this.advance()) {
      case 't':
        return '\t';
      case 'n':
        return '\n';
      case '\\':
        return '\\';
      case 'r':
        return '\r';
      case "'":
        return "'";
      case '"':
        return '"';
      case '0':
        return '\0';
      case 'b':
        return '\b';
      case 'v':
        return '\v';
      case 'f':
        return '\f';
      case 'u': {
        let hex = '';
        for (let i = 0; i <= 3; i += 1) {
          if (this.isAtEnd() || !isAlphaNumeric(this.peek()!)) {
            return `\\u${hex}`;
          }
          hex += this.advance();
        }

        return String.fromCharCode(parseInt(hex, 16));
      }
      default:
        return `\\${this.tokens[this.current.offset - 1]}`;
    }
  }
}
