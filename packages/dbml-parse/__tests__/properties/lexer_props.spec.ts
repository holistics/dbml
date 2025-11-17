import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Lexer from '../../src/lib/lexer/lexer';
import { SyntaxTokenKind } from '../../src';
import { tokenStreamArbitrary } from './arbitraries/tokens';

describe('lexing', () => {
  it('should roundtrip', () => {
    // Process: Source 1 -lex-> Tokens -serialize-> Source 2
    // Property: Source 1 == Source 2
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const lexer = new Lexer(source);
        const tokens = lexer.lex().getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        const newSource = tokens.map((token) => source.slice(token.start, token.end)).join('');
        expect(newSource).toEqual(source);
      }),
    );
  });

  it('should produce no gap', () => {
    // Property: Lexed tokens should be contiguous
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const lexer = new Lexer(source);
        const tokens = lexer.lex().getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        tokens.reduce((prevTokenEnd, token) => {
          expect(prevTokenEnd).toBe(token.start);
          return token.end;
        }, 0);
      }),
    );
  });

  it('should produce consistent lines/columns and offsets', () => {
    // Property: Lexed tokens' lines and columns should locate the same text as their offsets
    function convertLineAndColumnToOffset (source: string, line: number, col: number): number {
      return source.split(/(?<=\n|\r\n)/).slice(0, line).map((str) => str.length).reduce((acc, cur) => acc + cur, 0) + col;
    }

    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const lexer = new Lexer(source);
        const tokens = lexer.lex().getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        tokens.forEach((token) => {
          const { startPos, endPos } = token;
          expect(startPos.offset).toEqual(convertLineAndColumnToOffset(source, startPos.line, startPos.column));
          expect(endPos.offset).toEqual(convertLineAndColumnToOffset(source, endPos.line, endPos.column));
        });
      }),
    );
  });

  it('should reset column after newline', () => {
    // Property: After a newline token, the column should be reset to 0
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const lexer = new Lexer(source);
        const tokens = lexer.lex().getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        tokens.reduce((isNewlinePrevious, token) => {
          if (isNewlinePrevious) expect(token.startPos.column).toBe(0);
          return token.kind === SyntaxTokenKind.NEWLINE;
        }, true);
      }),
    );
  });

  it('should increase line after newline', () => {
    // Property: After a newline token, the line should increase by 1
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const lexer = new Lexer(source);
        const tokens = lexer.lex().getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia]);
        tokens.reduce(([isNewlinePrevious, previousLine], token) => {
          if (isNewlinePrevious) expect(token.startPos.line).toBe(previousLine + 1);
          return [
            token.kind === SyntaxTokenKind.NEWLINE,
            token.startPos.line,
          ] as [boolean, number];
        }, [true, -1] as [boolean, number]);
      }),
    );
  });

  it('should concatenate', () => {
    // Property: Lexing the concatenated string would be the same as concatenating two lexed strings
    fc.assert(
      fc.property(tokenStreamArbitrary, tokenStreamArbitrary, (source1: string, source2: string) => {
        const tokens1 = (new Lexer(source1)).lex().getValue()
          .flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia])
          .slice(0, -1)
          .map((token) => `${token.kind}:${token.value}`);
        const tokens2 = (new Lexer(source2)).lex().getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia])
          .slice(0, -1)
          .map((token) => `${token.kind}:${token.value}`);

        const source3 = `${source1}\n${source2}`;
        const tokens3 = (new Lexer(source3)).lex().getValue().flatMap((token) => [...token.leadingTrivia, token, ...token.trailingTrivia])
          .map((token) => `${token.kind}:${token.value}`);

        expect([...tokens1, `${SyntaxTokenKind.NEWLINE}:\n`, ...tokens2, `${SyntaxTokenKind.EOF}:`]).toEqual(tokens3);
      }),
    );
  });

  it('should have only whitespaces and comments as trivial tokens', () => {
    fc.assert(
      fc.property(tokenStreamArbitrary, (source: string) => {
        const tokens = (new Lexer(source)).lex().getValue()
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
    );
  });
});
