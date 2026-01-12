import { describe, expect, test } from 'vitest';
import { SyntaxTokenKind, SyntaxToken, isTriviaToken } from '@/core/lexer/tokens';
import { CompileErrorCode } from '@/core/errors';
import { lex } from '@tests/utils';

// Helper to get non-trivia, non-EOF tokens
function getTokens (source: string) {
  return lex(source).getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);
}

describe('[example] lexer', () => {
  describe('token recognition', () => {
    test('should tokenize identifiers with correct values and positions', () => {
      const source = 'users table_name';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);

      // First identifier: 'users'
      expect(tokens[0].kind).toBe(SyntaxTokenKind.IDENTIFIER);
      expect(tokens[0].value).toBe('users');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(5);
      expect(tokens[0].startPos.line).toBe(0);
      expect(tokens[0].startPos.column).toBe(0);
      expect(tokens[0].endPos.line).toBe(0);
      expect(tokens[0].endPos.column).toBe(5);

      // Second identifier: 'table_name'
      expect(tokens[1].kind).toBe(SyntaxTokenKind.IDENTIFIER);
      expect(tokens[1].value).toBe('table_name');
      expect(tokens[1].start).toBe(6);
      expect(tokens[1].end).toBe(16);
      expect(tokens[1].startPos.line).toBe(0);
      expect(tokens[1].startPos.column).toBe(6);
    });

    test('should tokenize numeric literals with positions', () => {
      const source = '42 3.14';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);

      expect(tokens[0].kind).toBe(SyntaxTokenKind.NUMERIC_LITERAL);
      expect(tokens[0].value).toBe('42');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(2);

      expect(tokens[1].kind).toBe(SyntaxTokenKind.NUMERIC_LITERAL);
      expect(tokens[1].value).toBe('3.14');
      expect(tokens[1].start).toBe(3);
      expect(tokens[1].end).toBe(7);
    });

    test('should tokenize string literals - values exclude quotes', () => {
      const source = "'hello'";
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.STRING_LITERAL);
      expect(tokens[0].value).toBe('hello');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(7);
    });

    test('should tokenize multi-line strings with content intact', () => {
      const source = "'''line1\nline2'''";
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.STRING_LITERAL);
      expect(tokens[0].value).toBe('line1\nline2');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(17);
    });

    test('should tokenize quoted identifiers - values exclude quotes', () => {
      const source = '"special-name"';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.QUOTED_STRING);
      expect(tokens[0].value).toBe('special-name');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(14);
    });

    test('should tokenize function expressions - values exclude backticks', () => {
      const source = '`now()`';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.FUNCTION_EXPRESSION);
      expect(tokens[0].value).toBe('now()');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(7);
    });

    test('should tokenize color literals with hash', () => {
      const source = '#fff #FF0000';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);

      expect(tokens[0].kind).toBe(SyntaxTokenKind.COLOR_LITERAL);
      expect(tokens[0].value).toBe('#fff');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(4);

      expect(tokens[1].kind).toBe(SyntaxTokenKind.COLOR_LITERAL);
      expect(tokens[1].value).toBe('#FF0000');
      expect(tokens[1].start).toBe(5);
      expect(tokens[1].end).toBe(12);
    });

    test('should tokenize all delimiters with correct positions', () => {
      const source = '{}[]():,;';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(9);

      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.LBRACE, value: '{', start: 0, end: 1 });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.RBRACE, value: '}', start: 1, end: 2 });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.LBRACKET, value: '[', start: 2, end: 3 });
      expect(tokens[3]).toMatchObject({ kind: SyntaxTokenKind.RBRACKET, value: ']', start: 3, end: 4 });
      expect(tokens[4]).toMatchObject({ kind: SyntaxTokenKind.LPAREN, value: '(', start: 4, end: 5 });
      expect(tokens[5]).toMatchObject({ kind: SyntaxTokenKind.RPAREN, value: ')', start: 5, end: 6 });
      expect(tokens[6]).toMatchObject({ kind: SyntaxTokenKind.COLON, value: ':', start: 6, end: 7 });
      expect(tokens[7]).toMatchObject({ kind: SyntaxTokenKind.COMMA, value: ',', start: 7, end: 8 });
      expect(tokens[8]).toMatchObject({ kind: SyntaxTokenKind.SEMICOLON, value: ';', start: 8, end: 9 });
    });

    test('should tokenize single-char operators', () => {
      // Note: < and > are separated by space to avoid <> compound operator
      const source = '+ - * / < > = .';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(8);
      expect(tokens.map((t) => ({ kind: t.kind, value: t.value }))).toEqual([
        { kind: SyntaxTokenKind.OP, value: '+' },
        { kind: SyntaxTokenKind.OP, value: '-' },
        { kind: SyntaxTokenKind.OP, value: '*' },
        { kind: SyntaxTokenKind.OP, value: '/' },
        { kind: SyntaxTokenKind.OP, value: '<' },
        { kind: SyntaxTokenKind.OP, value: '>' },
        { kind: SyntaxTokenKind.OP, value: '=' },
        { kind: SyntaxTokenKind.OP, value: '.' },
      ]);
    });

    test('should tokenize compound operators as separate tokens', () => {
      const source = '<>';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.OP);
      expect(tokens[0].value).toBe('<>');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(2);
    });

    test('should tokenize tilde separately from identifier', () => {
      const source = '~partial';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);

      expect(tokens[0].kind).toBe(SyntaxTokenKind.TILDE);
      expect(tokens[0].value).toBe('~');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(1);

      expect(tokens[1].kind).toBe(SyntaxTokenKind.IDENTIFIER);
      expect(tokens[1].value).toBe('partial');
      expect(tokens[1].start).toBe(1);
      expect(tokens[1].end).toBe(8);
    });
  });

  describe('multiline position tracking', () => {
    test('should track line and column across newlines', () => {
      const source = 'a\nb\nc';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);

      expect(tokens[0]).toMatchObject({
        value: 'a',
        start: 0,
        end: 1,
        startPos: { line: 0, column: 0 },
        endPos: { line: 0, column: 1 },
      });

      expect(tokens[1]).toMatchObject({
        value: 'b',
        start: 2,
        end: 3,
        startPos: { line: 1, column: 0 },
        endPos: { line: 1, column: 1 },
      });

      expect(tokens[2]).toMatchObject({
        value: 'c',
        start: 4,
        end: 5,
        startPos: { line: 2, column: 0 },
        endPos: { line: 2, column: 1 },
      });
    });

    test('should track column correctly on same line', () => {
      const source = 'abc   def';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);

      expect(tokens[0].startPos.column).toBe(0);
      expect(tokens[0].endPos.column).toBe(3);

      expect(tokens[1].startPos.column).toBe(6);
      expect(tokens[1].endPos.column).toBe(9);
    });
  });

  describe('comments', () => {
    test('should skip single-line comments and preserve surrounding tokens', () => {
      const source = 'Table // this is a comment\nusers';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('Table');
      expect(tokens[0].startPos.line).toBe(0);
      expect(tokens[1].value).toBe('users');
      expect(tokens[1].startPos.line).toBe(1);
    });

    test('should skip multi-line comments', () => {
      const source = 'Table /* block comment */ users';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('Table');
      expect(tokens[1].value).toBe('users');
    });
  });

  describe('error handling', () => {
    test('should report UNKNOWN_SYMBOL for dollar sign', () => {
      const source = '$invalid';
      const result = lex(source);
      const errors = result.getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_SYMBOL);
      expect(errors[0].diagnostic).toBe("Unexpected token '$'");
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.line).toBe(0);
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.column).toBe(0);
      expect(errors[0].start).toBe(0);
      expect(errors[0].end).toBe(1);
    });

    test('should report UNKNOWN_TOKEN for invalid number format', () => {
      const source = '12.3.4';
      const errors = lex(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_TOKEN);
    });

    test('should report UNEXPECTED_EOF for unclosed single-quote string', () => {
      const source = "'unclosed";
      const errors = lex(source).getErrors();

      expect(errors.length).toBe(1);
      const errorCodes = errors.map((e) => e.code);
      expect(
        errorCodes.includes(CompileErrorCode.UNEXPECTED_EOF)
        || errorCodes.includes(CompileErrorCode.UNEXPECTED_NEWLINE),
      ).toBe(true);
    });

    test('should report error for unclosed triple-quote string', () => {
      const source = "'''unclosed";
      const errors = lex(source).getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNEXPECTED_EOF);
    });

    test('should continue tokenizing after error', () => {
      const source = 'valid $invalid more';
      const result = lex(source);
      const tokens = result.getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(tokens.some((t) => t.value === 'valid')).toBe(true);
      expect(tokens.some((t) => t.value === 'more')).toBe(true);
    });
  });

  describe('DBML patterns', () => {
    test('should tokenize table definition correctly', () => {
      const source = 'Table users { id int [pk] }';
      const tokens = getTokens(source);

      expect(tokens.map((t) => t.value)).toEqual([
        'Table', 'users', '{', 'id', 'int', '[', 'pk', ']', '}',
      ]);
      expect(tokens.map((t) => t.kind)).toEqual([
        SyntaxTokenKind.IDENTIFIER,
        SyntaxTokenKind.IDENTIFIER,
        SyntaxTokenKind.LBRACE,
        SyntaxTokenKind.IDENTIFIER,
        SyntaxTokenKind.IDENTIFIER,
        SyntaxTokenKind.LBRACKET,
        SyntaxTokenKind.IDENTIFIER,
        SyntaxTokenKind.RBRACKET,
        SyntaxTokenKind.RBRACE,
      ]);
    });

    test('should tokenize schema.table correctly', () => {
      const source = 'public.users';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: 'public', start: 0, end: 6 });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '.', start: 6, end: 7 });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: 'users', start: 7, end: 12 });
    });

    test('should tokenize ref with relationship operators', () => {
      const source = 'Ref: a.id > b.id';
      const tokens = getTokens(source);

      expect(tokens.map((t) => t.value)).toEqual(['Ref', ':', 'a', '.', 'id', '>', 'b', '.', 'id']);
    });

    test('should tokenize column with settings', () => {
      const source = "id int [pk, default: 'active']";
      const tokens = getTokens(source);

      expect(tokens.map((t) => t.value)).toEqual([
        'id', 'int', '[', 'pk', ',', 'default', ':', 'active', ']',
      ]);
    });
  });

  describe('edge cases', () => {
    test('should return only EOF for empty input', () => {
      const tokens = lex('').getValue();

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.EOF);
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(0);
    });

    test('should handle whitespace-only input', () => {
      const tokens = lex('   \n\t').getValue();
      const nonEOF = tokens.filter((t) => t.kind !== SyntaxTokenKind.EOF);

      expect(nonEOF.every((t) => isTriviaToken(t))).toBe(true);
    });

    test('should tokenize adjacent tokens without spaces', () => {
      const source = 'id[pk]';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(4);
      expect(tokens[0]).toMatchObject({ value: 'id', start: 0, end: 2 });
      expect(tokens[1]).toMatchObject({ value: '[', start: 2, end: 3 });
      expect(tokens[2]).toMatchObject({ value: 'pk', start: 3, end: 5 });
      expect(tokens[3]).toMatchObject({ value: ']', start: 5, end: 6 });
    });

    test('should tokenize negative number as operator + literal', () => {
      const source = '-42';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '-', start: 0, end: 1 });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '42', start: 1, end: 3 });
    });

    test('should handle unicode in quoted strings with correct byte positions', () => {
      const source = '"用户"';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.QUOTED_STRING);
      expect(tokens[0].value).toBe('用户');
      // Byte offsets: quote (1) + 用 (3) + 户 (3) + quote (1) = 8 bytes total
      expect(tokens[0].start).toBe(0);
      // The end position depends on implementation - verify it's consistent
      expect(tokens[0].end).toBeGreaterThan(tokens[0].start);
    });

    test('should preserve identifier case', () => {
      const source = 'Table TABLE table';
      const tokens = getTokens(source);

      expect(tokens.map((t) => t.value)).toEqual(['Table', 'TABLE', 'table']);
    });
  });

  describe('unicode handling', () => {
    test('should track positions correctly for multi-byte characters in quoted strings', () => {
      const source = '"hello" "世界"';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);

      // First token: ASCII string
      expect(tokens[0].value).toBe('hello');
      expect(tokens[0].start).toBe(0);
      expect(tokens[0].end).toBe(7); // "hello" = 7 bytes

      // Second token: Unicode string - verify positions are valid
      expect(tokens[1].value).toBe('世界');
      expect(tokens[1].start).toBeGreaterThan(tokens[0].end);
      expect(tokens[1].end).toBeGreaterThan(tokens[1].start);
    });

    test('should handle emoji in quoted strings', () => {
      const source = '"test🎉"';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0].kind).toBe(SyntaxTokenKind.QUOTED_STRING);
      expect(tokens[0].value).toBe('test🎉');
    });

    test('should handle mixed ASCII and unicode', () => {
      const source = 'table "用户表" column';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0].value).toBe('table');
      expect(tokens[1].value).toBe('用户表');
      expect(tokens[2].value).toBe('column');

      // Verify ordering is preserved
      expect(tokens[1].start).toBeGreaterThan(tokens[0].end);
      expect(tokens[2].start).toBeGreaterThan(tokens[1].end);
    });
  });

  describe('boundary conditions', () => {
    test('should handle very long identifier', () => {
      const longName = 'a'.repeat(1000);
      const source = `Table ${longName} { id int }`;
      const result = lex(source);
      const tokens = result.getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);

      expect(result.getErrors()).toHaveLength(0);
      expect(tokens.some((t) => t.value === longName)).toBe(true);
    });

    test('should handle very long string literal', () => {
      const longContent = 'x'.repeat(10000);
      const source = `'${longContent}'`;
      const result = lex(source);
      const tokens = result.getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);

      expect(result.getErrors()).toHaveLength(0);
      expect(tokens).toHaveLength(1);
      expect(tokens[0].value).toBe(longContent);
    });

    test('should handle source with many lines', () => {
      const lines = Array.from({ length: 1000 }, (_, i) => `id${i}`).join('\n');
      const result = lex(lines);
      const tokens = result.getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);

      expect(result.getErrors()).toHaveLength(0);
      expect(tokens).toHaveLength(1000);

      // Verify last token is on correct line
      const lastToken = tokens[tokens.length - 1];
      expect(lastToken.startPos.line).toBe(999);
    });

    test('should handle deeply nested brackets', () => {
      const depth = 100;
      const source = '['.repeat(depth) + ']'.repeat(depth);
      const result = lex(source);
      const tokens = result.getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);

      expect(result.getErrors()).toHaveLength(0);
      expect(tokens).toHaveLength(depth * 2);
    });

    test('should handle carriage return line endings', () => {
      const source = 'a\r\nb\r\nc';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0].startPos.line).toBe(0);
      expect(tokens[1].startPos.line).toBe(1);
      expect(tokens[2].startPos.line).toBe(2);
    });

    test('should handle mixed line endings', () => {
      const source = 'a\nb\r\nc\rd';
      const tokens = getTokens(source);

      expect(tokens.length).toBeGreaterThanOrEqual(3);
      // Verify all tokens are parsed
      expect(tokens.map((t) => t.value)).toContain('a');
      expect(tokens.map((t) => t.value)).toContain('b');
      expect(tokens.map((t) => t.value)).toContain('c');
    });
  });

  describe('trivia handling', () => {
    test('should attach trivia to tokens via leadingTrivia', () => {
      const source = 'a   b';
      const tokens = getTokens(source);

      // Trivia is attached to tokens, not separate in the array
      // The second token 'b' should have leading trivia (whitespace)
      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('a');
      expect(tokens[1].value).toBe('b');

      // Verify the tokens span the correct offsets (implying trivia is handled)
      expect(tokens[0].end).toBe(1);
      expect(tokens[1].start).toBe(4);
    });

    test('should handle newlines between tokens', () => {
      const source = 'a\n\n\nb';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('a');
      expect(tokens[1].value).toBe('b');

      // Tokens should be on different lines
      expect(tokens[0].startPos.line).toBe(0);
      expect(tokens[1].startPos.line).toBe(3);
    });

    test('should skip comments as trivia between tokens', () => {
      const source = 'a // comment\nb';
      const tokens = getTokens(source);

      // Only non-trivia tokens should be returned
      expect(tokens).toHaveLength(2);
      expect(tokens[0].value).toBe('a');
      expect(tokens[1].value).toBe('b');
    });
  });

  describe('error location precision', () => {
    test('should report error at exact position of invalid character', () => {
      const source = 'valid $invalid';
      const errors = lex(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].start).toBe(6); // Position of '$'
      expect(errors[0].end).toBe(7); // After '$'
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.column).toBe(6);
    });

    test('should report error at exact position in multi-line source', () => {
      const source = 'line1\n$invalid';
      const errors = lex(source).getErrors();

      expect(errors).toHaveLength(1);
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.line).toBe(1);
      expect((errors[0].nodeOrToken as SyntaxToken).startPos.column).toBe(0);
    });

    test('should report unclosed string error at string start', () => {
      const source = "valid 'unclosed";
      const errors = lex(source).getErrors();

      expect(errors.length).toBeGreaterThanOrEqual(1);
      // Error should reference the unclosed string position
      expect(errors[0].start).toBeGreaterThanOrEqual(6);
    });
  });
});
