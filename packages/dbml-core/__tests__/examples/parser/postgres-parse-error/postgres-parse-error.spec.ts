import { parse } from '../../../../src/parse/ANTLR/ASTGeneration';
import { CompilerError } from '../../../../src/parse/error';
import { test, expect, describe } from 'vitest';

describe('@dbml/core - postgres parse error handling', () => {
  test('keyword used as column name should throw CompilerError, not TypeError', () => {
    // "open" is a PostgreSQL keyword not included in colid's keyword categories,
    // so it causes a syntax error. Previously this would crash with:
    //   TypeError: undefined is not an object (evaluating 'e.location.start')
    // because visitColumnDef accessed `type.type_name` on undefined, producing
    // a TypeError without a `location` property that CompilerError.create couldn't handle.
    const input = `CREATE TABLE IF NOT EXISTS users (
  id serial primary key,
  open boolean DEFAULT false NOT NULL
);`;

    expect(() => parse(input, 'postgres')).toThrow();

    try {
      parse(input, 'postgres');
    } catch (e) {
      // Should be an array of SyntaxErrors with location, not a TypeError
      expect(e).toBeInstanceOf(Array);
      expect(e.length).toBeGreaterThan(0);
      for (const err of e as any[]) {
        expect(err).toHaveProperty('location');
        expect(err.location).toHaveProperty('start');
        expect(err.location.start).toHaveProperty('line');
        expect(err.location.start).toHaveProperty('column');
      }
    }
  });

  test('keyword used as only column name should throw CompilerError, not TypeError', () => {
    const input = `CREATE TABLE IF NOT EXISTS users (
  open boolean DEFAULT false NOT NULL
);`;

    expect(() => parse(input, 'postgres')).toThrow();

    try {
      parse(input, 'postgres');
    } catch (e) {
      expect(e).toBeInstanceOf(Array);
      expect(e.length).toBeGreaterThan(0);
      for (const err of e as any[]) {
        expect(err).toHaveProperty('location');
        expect(err.location).toHaveProperty('start');
      }
    }
  });
});
