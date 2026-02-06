import { describe, expect, test } from 'vitest';
import { SyntaxTokenKind, isTriviaToken } from '@/core/lexer/tokens';
import { CompileErrorCode } from '@/core/errors';
import { lex } from '@tests/utils';

// Helper to get non-trivia, non-EOF tokens
function getTokens (source: string) {
  return lex(source).getValue().filter((t) => !isTriviaToken(t) && t.kind !== SyntaxTokenKind.EOF);
}

describe('[example] lexer - scientific notation', () => {
  describe('valid scientific notation', () => {
    test('should tokenize integer with exponent', () => {
      const source = '1e2 1E2 1e+2 1e-2';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(4);

      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e2' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1E2' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e+2' });
      expect(tokens[3]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e-2' });
    });

    test('should tokenize decimal with exponent', () => {
      const source = '3.14e10 2.5E-3 1.0e+5';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);

      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '3.14e10' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '2.5E-3' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1.0e+5' });
    });

    test('should tokenize scientific notation at end of input', () => {
      const source = '1e2';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e2' });
    });

    test('should tokenize scientific notation followed by delimiter', () => {
      const source = '1e2,3e4';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e2' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.COMMA, value: ',' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '3e4' });
    });

    test('should tokenize large exponents', () => {
      const source = '1e100 2.5e-50';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e100' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '2.5e-50' });
    });

    test('should tokenize scientific notation in DBML context', () => {
      const source = 'default: 1e-5';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: 'default' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.COLON, value: ':' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e-5' });
    });

    test('should tokenize zero exponent', () => {
      const source = '1e0 5.5e0';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e0' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '5.5e0' });
    });
  });

  describe('floating point numbers', () => {
    test('should tokenize simple floating points', () => {
      const source = '3.14 0.5 123.456';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '3.14' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '0.5' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '123.456' });
    });

    test('should tokenize floating point at end of input', () => {
      const source = '3.14';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '3.14' });
    });

    test('should tokenize floating point followed by delimiter', () => {
      const source = '3.14,2.71';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '3.14' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.COMMA, value: ',' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '2.71' });
    });
  });

  describe('identifiers starting with digits', () => {
    test('should tokenize digit followed by letters as identifier', () => {
      const source = '1abc 2test 3rd';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1abc' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '2test' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '3rd' });
    });

    test('should tokenize digit-letter-digit as identifier', () => {
      const source = '1a2b3c';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1a2b3c' });
    });

    test('should tokenize 1e as identifier (incomplete exponent)', () => {
      const source = '1e';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1e' });
    });

    test('should tokenize 1ea as identifier', () => {
      const source = '1ea';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1ea' });
    });

    test('should tokenize 1e2abc as identifier (valid exponent followed by letters)', () => {
      const source = '1e2abc';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1e2abc' });
    });

    test('should tokenize 5e10abcbd as identifier', () => {
      const source = '5e10abcbd';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(1);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '5e10abcbd' });
    });
  });

  describe('incomplete exponent with sign - sign not consumed', () => {
    test('should tokenize 1e+ as identifier and operator', () => {
      // Sign is NOT consumed when no digit follows
      const source = '1e+';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1e' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '+' });
    });

    test('should tokenize 1e- as identifier and operator', () => {
      const source = '1e-';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(2);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1e' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '-' });
    });

    test('should tokenize 1e+a as identifier, operator, identifier', () => {
      const source = '1e+a';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1e' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '+' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: 'a' });
    });

    test('should tokenize 1e-b as identifier, operator, identifier', () => {
      const source = '1e-b';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: '1e' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '-' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: 'b' });
    });
  });

  describe('invalid numbers - multiple dots', () => {
    test('should report error for number with two dots', () => {
      const source = '1.2.3';
      const result = lex(source);
      const errors = result.getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_TOKEN);
    });

    test('should report error for two dots before exponent', () => {
      const source = '1.2.3e4';
      const result = lex(source);
      const errors = result.getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_TOKEN);
    });

    test('should tokenize 1.5e2.5 as number, dot, number (second dot after exponent)', () => {
      // 1.5e2 is valid, then . and 5 are separate tokens
      const source = '1.5e2.5';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1.5e2' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '.' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '5' });
    });

    test('should report error for decimal with letters', () => {
      const source = '3.14abc';
      const result = lex(source);
      const errors = result.getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_TOKEN);
    });

    test('should report error for decimal scientific with letters', () => {
      const source = '3.14e2xyz';
      const result = lex(source);
      const errors = result.getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.UNKNOWN_TOKEN);
    });
  });

  describe('edge cases with dot after exponent', () => {
    test('should tokenize 1e2.5 as number, dot, number', () => {
      // No dot before 'e', so 1e2 is valid, then . and 5 are separate
      const source = '1e2.5';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '1e2' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '.' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '5' });
    });

    test('should tokenize 5e10.method as number, dot, identifier', () => {
      const source = '5e10.method';
      const tokens = getTokens(source);

      expect(tokens).toHaveLength(3);
      expect(tokens[0]).toMatchObject({ kind: SyntaxTokenKind.NUMERIC_LITERAL, value: '5e10' });
      expect(tokens[1]).toMatchObject({ kind: SyntaxTokenKind.OP, value: '.' });
      expect(tokens[2]).toMatchObject({ kind: SyntaxTokenKind.IDENTIFIER, value: 'method' });
    });
  });
});
