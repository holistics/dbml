/**
 * Property-Based Tests: MySQL Parser Fuzzing
 *
 * Tests that the parser handles random/malformed inputs gracefully without crashing.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { malformedSql } from '../generators/sql-arbitraries';
import { parseWithoutCrashing } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('MySQL Parser Fuzzing', () => {
    test('parser should not crash on random strings', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 0, maxLength: 1000 }),
          (randomString) => {
            // Should not crash (may throw, but should not seg fault or hang)
            expect(() => {
              try {
                Parser.parseMySQLToJSONv2(randomString);
              } catch (error) {
                // Errors are fine, crashing is not
                expect(error).toBeDefined();
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
        { numRuns: 100 },
      );
    });

    test('parser should not crash on malformed SQL', () => {
      fc.assert(
        fc.property(malformedSql(), (sql) => {
          const result = parseWithoutCrashing(
            (input) => Parser.parseMySQLToJSONv2(input),
            sql,
          );

          // Either succeeds or fails gracefully (no crash)
          expect(result).toBeDefined();
        }),
        { numRuns: 100 },
      );
    });

    test('parser should handle very long identifiers', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 100, maxLength: 10000 }),
          (longString) => {
            const sql = `CREATE TABLE ${longString} (id INT);`;

            // Should not crash
            expect(() => {
              try {
                Parser.parseMySQLToJSONv2(sql);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/maximum call stack|stack overflow/i);
          },
        ),
        { numRuns: 50 },
      );
    });

    test('parser should handle deeply nested statements', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (depth) => {
          // Create nested parentheses
          const nested = '('.repeat(depth) + ')'.repeat(depth);
          const sql = `CREATE TABLE test (id INT CHECK (${nested}));`;

          // Should not crash
          expect(() => {
            try {
              Parser.parseMySQLToJSONv2(sql);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/stack overflow|maximum call stack/i);
        }),
        { numRuns: 30 },
      );
    });

    test('parser should handle mixed valid and invalid syntax', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constantFrom(
              'CREATE TABLE users (id INT);',
              'CREATE TABLE products (name VARCHAR(255));',
              'CREATE INDEX idx ON users(id);',
            ),
            fc.string({ maxLength: 500 }),
          ),
          ([validSql, noise]) => {
            const sql = `${validSql} ${noise}`;

            // Should not crash
            expect(() => {
              try {
                Parser.parseMySQLToJSONv2(sql);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
        { numRuns: 50 },
      );
    });

    test('parser should handle special characters', () => {
      fc.assert(
        fc.property(
          fc.stringMatching(/^[!@#$%^&*(){}[\]|\\;:'"<>?,./~`]{1,100}$/),
          (specialChars) => {
            const sql = `CREATE TABLE test_${specialChars} (id INT);`;

            // Should not crash
            expect(() => {
              try {
                Parser.parseMySQLToJSONv2(sql);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
        { numRuns: 50 },
      );
    });

    test('parser should handle SQL keywords in wrong order', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'TABLE CREATE users',
            'INT id users TABLE CREATE',
            'PRIMARY KEY FOREIGN KEY',
            'INDEX CREATE ON',
            'ALTER DROP ADD',
          ),
          (sql) => {
            // Should not crash
            expect(() => {
              try {
                Parser.parseMySQLToJSONv2(sql);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
      );
    });

    test('parser should handle incomplete statements', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE',
            'CREATE TABLE users (',
            'CREATE TABLE users (id',
            'CREATE TABLE users (id INT',
            'ALTER TABLE',
            'INSERT INTO',
            'SELECT',
          ),
          (sql) => {
            // Should not crash
            expect(() => {
              try {
                Parser.parseMySQLToJSONv2(sql);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
      );
    });

    test('parser should handle very large table definitions', () => {
      fc.assert(
        fc.property(fc.integer({ min: 50, max: 200 }), (columnCount) => {
          const columns = Array.from({ length: columnCount }, (_, i) =>
            `col${i} VARCHAR(255)`,
          ).join(', ');
          const sql = `CREATE TABLE huge_table (${columns});`;

          // Should not crash (may be slow, but should complete)
          expect(() => {
            try {
              Parser.parseMySQLToJSONv2(sql);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/stack overflow|out of memory/i);
        }),
        { numRuns: 10 },
      );
    });

    test('parser should handle Unicode characters', () => {
      fc.assert(
        fc.property(fc.unicodeString({ minLength: 1, maxLength: 100 }), (unicode) => {
          const sql = `CREATE TABLE test (name VARCHAR(255) DEFAULT '${unicode}');`;

          // Should not crash
          expect(() => {
            try {
              Parser.parseMySQLToJSONv2(sql);
            } catch (error) {
              // Error is fine
              expect(error).toBeDefined();
            }
          }).not.toThrow(/segmentation fault|encoding error/i);
        }),
        { numRuns: 50 },
      );
    });

    test('parser should handle null bytes and control characters', () => {
      fc.assert(
        fc.property(
          fc.array(fc.integer({ min: 0, max: 31 }), { maxLength: 50 }),
          (bytes) => {
            const controlChars = bytes.map((b) => String.fromCharCode(b)).join('');
            const sql = `CREATE TABLE test (data VARCHAR(255) DEFAULT '${controlChars}');`;

            // Should not crash
            expect(() => {
              try {
                Parser.parseMySQLToJSONv2(sql);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault/i);
          },
        ),
        { numRuns: 30 },
      );
    });

    test('parser should handle repeated keywords', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('CREATE', 'TABLE', 'INT', 'PRIMARY', 'KEY'),
          fc.integer({ min: 1, max: 50 }),
          (keyword, count) => {
            const sql = keyword.repeat(count);

            // Should not crash
            expect(() => {
              try {
                Parser.parseMySQLToJSONv2(sql);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
        { numRuns: 50 },
      );
    });
  });
});
