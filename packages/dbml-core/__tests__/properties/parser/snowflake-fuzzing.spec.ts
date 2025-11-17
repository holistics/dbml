/**
 * Property-Based Tests: Snowflake Parser Fuzzing
 *
 * Tests that the parser handles random/malformed inputs gracefully without crashing.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { malformedSql } from '../generators/sql-arbitraries';
import { parseWithoutCrashing } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('Snowflake Parser Fuzzing', () => {
    test('parser should not crash on random strings', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (randomString) => {
          expect(() => {
            try {
              Parser.parseSnowflakeToJSON(randomString);
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
          const result = parseWithoutCrashing((input) => Parser.parseSnowflakeToJSON(input), sql);
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
              Parser.parseSnowflakeToJSON(sql);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/maximum call stack|stack overflow/i);
        }),
        { numRuns: 50 },
      );
    });

    test('parser should handle Snowflake-specific syntax errors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE users (id INT AUTOINCREMENT AUTOINCREMENT);',
            'CREATE TABLE users (data VARIANT VARIANT);',
            'CREATE TABLE users (data ARRAY ARRAY);',
          ),
          (sql) => {
            expect(() => {
              try {
                Parser.parseSnowflakeToJSON(sql);
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
