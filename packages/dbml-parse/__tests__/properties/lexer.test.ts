import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import { SyntaxTokenKind } from '../../src';
import { tokenStreamArbitrary, identifierArbitrary } from '../utils/arbitraries';
import { lex } from '../utils';

// Run count rationale:
// - 200: Standard for fast operations (lexer ~0.5ms/run)
// - 100: Reduced for complex assertions with multiple checks per token
const PROPERTY_TEST_CONFIG = { numRuns: 200 };
const EXTENDED_CONFIG = { numRuns: 100 };

describe('[property] lexer', () => {
  it('should roundtrip', () => {
    // Process: Source 1 -lex-> Tokens -serialize-> Source 2
    // Property: Source 1 == Source 2
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        const newSource = tokens.map((token) => source.slice(token.start, token.end)).join('');
        expect(newSource).toEqual(source);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should produce no gap', () => {
    // Property: Lexed tokens should be contiguous
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        tokens.reduce((prevTokenEnd, token) => {
          expect(prevTokenEnd).toBe(token.start);
          return token.end;
        }, 0);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should produce consistent lines/columns and offsets', () => {
    // Property: Lexed tokens' lines and columns should locate the same text as their offsets
    // Converts line (0-indexed) and column to character offset by summing line lengths
    function convertLineAndColumnToOffset (source: string, line: number, col: number): number {
      return source.split(/(?<=\n|\r\n)/).slice(0, line).map((str) => str.length).reduce((acc, cur) => acc + cur, 0) + col;
    }

    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        tokens.forEach((token) => {
          const { startPos, endPos } = token;
          expect(startPos.offset).toEqual(convertLineAndColumnToOffset(source, startPos.line, startPos.column));
          expect(endPos.offset).toEqual(convertLineAndColumnToOffset(source, endPos.line, endPos.column));
        });
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should reset column after newline', () => {
    // Property: After a newline token, the column should be reset to 0
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        tokens.reduce((isNewlinePrevious, token) => {
          if (isNewlinePrevious) expect(token.startPos.column).toBe(0);
          return token.kind === SyntaxTokenKind.NEWLINE;
        }, true);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should increase line after newline', () => {
    // Property: After a newline token, the line should increase by 1
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        tokens.reduce(([isNewlinePrevious, previousLine], token) => {
          if (isNewlinePrevious) expect(token.startPos.line).toBe(previousLine + 1);
          return [
            token.kind === SyntaxTokenKind.NEWLINE,
            token.startPos.line,
          ] as [boolean, number];
        }, [true, -1] as [boolean, number]);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should concatenate', () => {
    // Property: Lexing the concatenated string would be the same as concatenating two lexed strings
    // Note: This only holds when source1 doesn't end with unclosed constructs (comments, strings)
    fc.assert(
      fc.property(tokenStreamArbitrary, tokenStreamArbitrary, (source1: string, source2: string) => {
        // Skip if source1 ends with unclosed multiline comment or single-line comment
        // (the newline would be absorbed into these constructs)
        fc.pre(!(source1.includes('/*') && !source1.includes('*/')));
        fc.pre(!(source1.endsWith('//') || /\/\/[^\n]*$/.test(source1)));
        // Skip if source1 ends with unclosed string/backtick
        fc.pre((source1.match(/'/g) || []).length % 2 === 0);
        fc.pre((source1.match(/"/g) || []).length % 2 === 0);
        fc.pre((source1.match(/`/g) || []).length % 2 === 0);

        const tokens1 = lex(source1).getValue()
          .flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia])
          .slice(0, -1)
          .map((token) => `${token.kind}:${token.value}`);
        const tokens2 = lex(source2).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia])
          .slice(0, -1)
          .map((token) => `${token.kind}:${token.value}`);

        const source3 = `${source1}\n${source2}`;
        const tokens3 = lex(source3).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia])
          .map((token) => `${token.kind}:${token.value}`);

        expect([...tokens1, `${SyntaxTokenKind.NEWLINE}:\n`, ...tokens2, `${SyntaxTokenKind.EOF}:`]).toEqual(tokens3);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have only whitespaces and comments as trivial tokens', () => {
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue()
          .flatMap((token) => [...token.leadingTrivia, ...token.trailingTrivia])
          .map((token) => token.kind);

        tokens.forEach((token) => expect(token).toBeOneOf([
          SyntaxTokenKind.NEWLINE,
          SyntaxTokenKind.SPACE,
          SyntaxTokenKind.TAB,
          SyntaxTokenKind.MULTILINE_COMMENT,
          SyntaxTokenKind.SINGLE_LINE_COMMENT,
        ]));
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have monotonically increasing token positions', () => {
    // Property: Token start positions should always increase
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);

        for (let i = 1; i < tokens.length; i++) {
          expect(tokens[i].start).toBeGreaterThanOrEqual(tokens[i - 1].end);
        }
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have monotonically increasing line numbers', () => {
    // Property: Line numbers should never decrease
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);

        let maxLine = 0;
        tokens.forEach((token) => {
          expect(token.startPos.line).toBeGreaterThanOrEqual(maxLine);
          maxLine = Math.max(maxLine, token.startPos.line);
        });
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have non-negative column positions', () => {
    // Property: Column positions should always be >= 0
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);

        tokens.forEach((token) => {
          expect(token.startPos.column).toBeGreaterThanOrEqual(0);
          expect(token.endPos.column).toBeGreaterThanOrEqual(0);
        });
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should have non-negative token lengths', () => {
    // Property: All tokens should have non-negative positional lengths
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);

        tokens.forEach((token) => {
          const positionalLength = token.end - token.start;
          expect(positionalLength).toBeGreaterThanOrEqual(0);
          expect(token.value).toBeDefined();
        });
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should have valid token kinds for all tokens', () => {
    // Property: All tokens should have defined, valid token kinds
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);

        tokens.forEach((token) => {
          expect(token.kind).toBeDefined();
          expect(typeof token.kind).toBe('string'); // SyntaxTokenKind is a string enum
        });
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should always end with EOF token', () => {
    // Property: Last non-trivia token should always be EOF
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue();
        const lastToken = tokens[tokens.length - 1];

        expect(lastToken.kind).toBe(SyntaxTokenKind.EOF);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have token values matching source slices for identifiers and operators', () => {
    // Property: Non-quoted tokens should have values matching source slices exactly
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);

        tokens.forEach((token) => {
          const rawSlice = source.slice(token.start, token.end);

          // Only test tokens where value should match raw slice exactly
          // Skip quoted/escaped tokens which have complex value transformations
          switch (token.kind) {
            case SyntaxTokenKind.IDENTIFIER:
            case SyntaxTokenKind.NUMERIC_LITERAL:
            case SyntaxTokenKind.COLOR_LITERAL:
            case SyntaxTokenKind.OP:
            case SyntaxTokenKind.LBRACE:
            case SyntaxTokenKind.RBRACE:
            case SyntaxTokenKind.LBRACKET:
            case SyntaxTokenKind.RBRACKET:
            case SyntaxTokenKind.LPAREN:
            case SyntaxTokenKind.RPAREN:
            case SyntaxTokenKind.COLON:
            case SyntaxTokenKind.COMMA:
            case SyntaxTokenKind.SEMICOLON:
            case SyntaxTokenKind.TILDE:
            case SyntaxTokenKind.NEWLINE:
            case SyntaxTokenKind.SPACE:
            case SyntaxTokenKind.TAB:
              expect(token.value).toBe(rawSlice);
              break;

            case SyntaxTokenKind.EOF:
              expect(token.value).toBe('');
              break;

            // For quoted tokens, just verify the value is derived from the slice
            case SyntaxTokenKind.STRING_LITERAL:
            case SyntaxTokenKind.QUOTED_STRING:
            case SyntaxTokenKind.FUNCTION_EXPRESSION:
              // Value should be a substring of rawSlice (quotes stripped)
              expect(rawSlice.includes(token.value) || token.value.length < rawSlice.length).toBe(true);
              break;

            default:
              // For comments and other trivia, value should be related to slice
              break;
          }
        });
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have non-overlapping token positions', () => {
    // Property: No two tokens should overlap in position
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);

        // Check no overlaps between consecutive tokens
        for (let i = 1; i < tokens.length; i++) {
          const prev = tokens[i - 1];
          const curr = tokens[i];

          // Current token should not start before previous token ends
          expect(curr.start).toBeGreaterThanOrEqual(prev.end);
        }
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should have offset equal to computed position', () => {
    // Property: startPos.offset should match the token start position
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = lex(source).getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);

        tokens.forEach((token) => {
          expect(token.startPos.offset).toBe(token.start);
          expect(token.endPos.offset).toBe(token.end);
        });
      }),
      EXTENDED_CONFIG,
    );
  });
});

// Negative property tests - verify certain inputs always produce errors
describe('[property] lexer - negative tests', () => {
  it('should report UNKNOWN_SYMBOL for dollar sign in any position', () => {
    fc.assert(
      fc.property(
        identifierArbitrary,
        identifierArbitrary,
        (before: string, after: string) => {
          // Insert $ between two identifiers - ensures no other special chars interfere
          const source = `${before} $ ${after}`;
          const result = lex(source);
          const errors = result.getErrors();

          expect(errors.length).toBeGreaterThan(0);
          expect(errors.some((e) => e.diagnostic.includes('$'))).toBe(true);
        },
      ),
      EXTENDED_CONFIG,
    );
  });

  it('should report error for unclosed single-quote strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }).filter((s) => !s.includes("'")),
        (content: string) => {
          // String with opening quote but no closing
          const source = `'${content}`;
          const result = lex(source);
          const errors = result.getErrors();

          expect(errors.length).toBeGreaterThan(0);
        },
      ),
      EXTENDED_CONFIG,
    );
  });

  it('should report error for unclosed double-quote strings', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }).filter((s) => !s.includes('"')),
        (content: string) => {
          const source = `"${content}`;
          const result = lex(source);
          const errors = result.getErrors();

          expect(errors.length).toBeGreaterThan(0);
        },
      ),
      EXTENDED_CONFIG,
    );
  });

  it('should report error for unclosed backtick expressions', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }).filter((s) => !s.includes('`')),
        (content: string) => {
          const source = `\`${content}`;
          const result = lex(source);
          const errors = result.getErrors();

          expect(errors.length).toBeGreaterThan(0);
        },
      ),
      EXTENDED_CONFIG,
    );
  });

  it('should report error for invalid number formats', () => {
    // Multiple decimal points should error
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        (a: number, b: number, c: number) => {
          const source = `${a}.${b}.${c}`;
          const result = lex(source);
          const errors = result.getErrors();

          expect(errors.length).toBeGreaterThan(0);
        },
      ),
      EXTENDED_CONFIG,
    );
  });

  it('should handle at-sign as unknown symbol', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 20 }),
        (suffix: string) => {
          const source = `@${suffix.replace(/@/g, '')}`;
          const result = lex(source);
          const errors = result.getErrors();

          expect(errors.length).toBeGreaterThan(0);
        },
      ),
      EXTENDED_CONFIG,
    );
  });
});
