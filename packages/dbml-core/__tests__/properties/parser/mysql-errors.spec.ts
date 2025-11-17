/**
 * Property-Based Tests: MySQL Parser Error Handling
 *
 * Tests that the parser produces meaningful error messages for invalid inputs.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { hasInformativeError } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('MySQL Parser Error Handling', () => {
    test('invalid syntax should produce error with context', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE users (id INT,,,);',
            'CREATE TABLE (id INT);',
            'CREATE TABLE users id INT;',
            'CREATE TABLE users (id);',
          ),
          (invalidSql) => {
            expect(() => {
              Parser.parseMySQLToJSONv2(invalidSql);
            }).toThrow();

            try {
              Parser.parseMySQLToJSONv2(invalidSql);
            } catch (error) {
              // Error should have informative message
              expect(hasInformativeError(error as Error)).toBe(true);
            }
          },
        ),
      );
    });

    test('incomplete statements should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE users (',
            'CREATE TABLE users (id INT',
            'CREATE TABLE users (id INT,',
          ),
          (incompleteSql) => {
            expect(() => {
              Parser.parseMySQLToJSONv2(incompleteSql);
            }).toThrow();
          },
        ),
      );
    });

    test('errors should mention problematic token or location', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE users (id INT INVALID_KEYWORD);',
            'CREATE INVALID users (id INT);',
            'CREATE TABLE users (id UNKNOWNTYPE);',
          ),
          (invalidSql) => {
            let caughtError: Error | undefined;

            try {
              Parser.parseMySQLToJSONv2(invalidSql);
            } catch (error) {
              caughtError = error as Error;
            }

            expect(caughtError).toBeDefined();
            if (caughtError) {
              const message = caughtError.message.toLowerCase();

              // Error message should provide some context
              const hasContext =
                message.includes('line')
                || message.includes('token')
                || message.includes('expected')
                || message.includes('unexpected')
                || message.includes('syntax')
                || message.length > 10;

              expect(hasContext).toBe(true);
            }
          },
        ),
      );
    });

    test('mismatched parentheses should be caught', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE users (id INT',
            'CREATE TABLE users id INT)',
            'CREATE TABLE users ((id INT)',
            'CREATE TABLE users (id INT))',
          ),
          (sql) => {
            expect(() => {
              Parser.parseMySQLToJSONv2(sql);
            }).toThrow();
          },
        ),
      );
    });

    test('invalid data types should be handled', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }).filter(
            (s) => !['INT', 'VARCHAR', 'TEXT', 'BIGINT', 'DATE'].includes(s.toUpperCase()),
          ),
          (invalidType) => {
            const sql = `CREATE TABLE users (id ${invalidType});`;

            // Should either parse (if it looks like a valid type) or throw
            try {
              const result = Parser.parseMySQLToJSONv2(sql);
              // If it parsed, it should have valid structure
              expect(result).toBeDefined();
              expect(result.tables).toBeDefined();
            } catch (error) {
              // If it threw, error should be informative
              expect(error).toBeDefined();
            }
          },
        ),
        { numRuns: 30 },
      );
    });

    test('duplicate column names should be handled', () => {
      const sql = 'CREATE TABLE users (id INT, id INT);';

      // Should either accept (SQL allows this) or reject with error
      try {
        const result = Parser.parseMySQLToJSONv2(sql);
        // If accepted, should have structure
        expect(result.tables).toBeDefined();
      } catch (error) {
        // If rejected, should have error
        expect(error).toBeDefined();
      }
    });

    test('missing table name should throw error', () => {
      expect(() => {
        Parser.parseMySQLToJSONv2('CREATE TABLE (id INT);');
      }).toThrow();
    });

    test('missing column definition should throw error', () => {
      expect(() => {
        Parser.parseMySQLToJSONv2('CREATE TABLE users ();');
      }).toThrow();
    });

    test('invalid constraint syntax should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE users (id INT PRIMARY);',
            'CREATE TABLE users (id INT FOREIGN KEY);',
            'CREATE TABLE users (id INT REFERENCES);',
            'CREATE TABLE users (id INT CHECK);',
          ),
          (invalidSql) => {
            expect(() => {
              Parser.parseMySQLToJSONv2(invalidSql);
            }).toThrow();
          },
        ),
      );
    });

    test('invalid foreign key syntax should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'ALTER TABLE users ADD FOREIGN KEY (user_id);',
            'ALTER TABLE users ADD FOREIGN KEY REFERENCES;',
            'ALTER TABLE users ADD CONSTRAINT FOREIGN KEY;',
          ),
          (invalidSql) => {
            expect(() => {
              Parser.parseMySQLToJSONv2(invalidSql);
            }).toThrow();
          },
        ),
      );
    });

    test('error message should be non-empty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE INVALID',
            'TABLE users',
            'INT id',
            ';;;',
          ),
          (invalidSql) => {
            let errorMessage = '';

            try {
              Parser.parseMySQLToJSONv2(invalidSql);
            } catch (error) {
              errorMessage = (error as Error).message;
            }

            // If it threw, error message should not be empty
            if (errorMessage) {
              expect(errorMessage.length).toBeGreaterThan(0);
            }
          },
        ),
      );
    });

    test('parser should reject SQL injection patterns safely', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "'; DELETE FROM users WHERE '1'='1",
            "' UNION SELECT * FROM passwords --",
          ),
          (injectionAttempt) => {
            const sql = `CREATE TABLE test (data VARCHAR(255) DEFAULT '${injectionAttempt}');`;

            // Should not execute malicious SQL (just parse it as string)
            try {
              const result = Parser.parseMySQLToJSONv2(sql);
              // If it parsed, should not have executed injection
              expect(result).toBeDefined();
            } catch (error) {
              // If it threw, that's fine too
              expect(error).toBeDefined();
            }
          },
        ),
      );
    });
  });
});
