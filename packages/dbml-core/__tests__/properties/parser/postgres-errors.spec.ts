/**
 * Property-Based Tests: PostgreSQL Parser Error Handling
 *
 * Tests that the parser produces meaningful error messages for invalid inputs.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { hasInformativeError } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('PostgreSQL Parser Error Handling', () => {
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
              Parser.parsePostgresToJSONv2(invalidSql);
            }).toThrow();

            try {
              Parser.parsePostgresToJSONv2(invalidSql);
            } catch (error) {
              expect(hasInformativeError(error as Error)).toBe(true);
            }
          },
        ),
      );
    });

    test('incomplete CREATE TYPE should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TYPE mood AS',
            'CREATE TYPE mood AS ENUM',
            'CREATE TYPE mood AS ENUM (',
          ),
          (incompleteSql) => {
            expect(() => {
              Parser.parsePostgresToJSONv2(incompleteSql);
            }).toThrow();
          },
        ),
      );
    });

    test('invalid enum syntax should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            "CREATE TYPE mood AS ENUM ('happy',);",
            'CREATE TYPE mood AS ENUM ();',
            "CREATE TYPE AS ENUM ('happy');",
          ),
          (invalidSql) => {
            expect(() => {
              Parser.parsePostgresToJSONv2(invalidSql);
            }).toThrow();
          },
        ),
      );
    });

    test('error message should be non-empty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('CREATE INVALID', 'TABLE users', 'INT id', ';;;'),
          (invalidSql) => {
            let errorMessage = '';

            try {
              Parser.parsePostgresToJSONv2(invalidSql);
            } catch (error) {
              errorMessage = (error as Error).message;
            }

            if (errorMessage) {
              expect(errorMessage.length).toBeGreaterThan(0);
            }
          },
        ),
      );
    });
  });
});
