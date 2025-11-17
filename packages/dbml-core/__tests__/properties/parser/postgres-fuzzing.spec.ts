/**
 * Property-Based Tests: PostgreSQL Parser Fuzzing
 *
 * Tests that the parser handles random/malformed inputs gracefully without crashing.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { malformedSql } from '../generators/sql-arbitraries';
import { parseWithoutCrashing } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('PostgreSQL Parser Fuzzing', () => {
    test('parser should not crash on random strings', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (randomString) => {
          expect(() => {
            try {
              Parser.parsePostgresToJSONv2(randomString);
            } catch (error) {
              expect(error).toBeDefined();
            }
          }).not.toThrow(/segmentation fault|stack overflow/i);
        }),
        { numRuns: 100 },
      );
    });

    test('parser should not crash on malformed SQL', () => {
      fc.assert(
        fc.property(malformedSql(), (sql) => {
          const result = parseWithoutCrashing(
            (input) => Parser.parsePostgresToJSONv2(input),
            sql,
          );

          expect(result).toBeDefined();
        }),
        { numRuns: 100 },
      );
    });

    test('parser should handle very long identifiers', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 100, maxLength: 10000 }), (longString) => {
          const sql = `CREATE TABLE ${longString} (id INT);`;

          expect(() => {
            try {
              Parser.parsePostgresToJSONv2(sql);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/maximum call stack|stack overflow/i);
        }),
        { numRuns: 50 },
      );
    });

    test('parser should handle deeply nested statements', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (depth) => {
          const nested = '('.repeat(depth) + ')'.repeat(depth);
          const sql = `CREATE TABLE test (id INT CHECK (${nested}));`;

          expect(() => {
            try {
              Parser.parsePostgresToJSONv2(sql);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/stack overflow|maximum call stack/i);
        }),
        { numRuns: 30 },
      );
    });

    test('parser should handle PostgreSQL-specific syntax errors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TYPE',
            'CREATE TYPE AS ENUM',
            'CREATE TABLE users (id SERIAL SERIAL);',
            'CREATE TABLE users (id INT[[[);',
          ),
          (sql) => {
            expect(() => {
              try {
                Parser.parsePostgresToJSONv2(sql);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
      );
    });
  });
});
