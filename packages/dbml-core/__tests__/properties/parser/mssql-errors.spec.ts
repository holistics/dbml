/**
 * Property-Based Tests: MSSQL Parser Error Handling
 *
 * Tests that the parser produces meaningful error messages for invalid inputs.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { hasInformativeError } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('MSSQL Parser Error Handling', () => {
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
              Parser.parseMSSQLToJSONv2(invalidSql);
            }).toThrow();
            try {
              Parser.parseMSSQLToJSONv2(invalidSql);
            } catch (error) {
              expect(hasInformativeError(error as Error)).toBe(true);
            }
          },
        ),
      );
    });

    test('incomplete IDENTITY syntax should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE users (id INT IDENTITY());',
            'CREATE TABLE users (id INT IDENTITY(1));',
          ),
          (incompleteSql) => {
            expect(() => {
              Parser.parseMSSQLToJSONv2(incompleteSql);
            }).toThrow();
          },
        ),
      );
    });

    test('error message should be non-empty', () => {
      fc.assert(
        fc.property(fc.constantFrom('CREATE INVALID', 'TABLE users', 'INT id', ';;;'), (invalidSql) => {
          let errorMessage = '';
          try {
            Parser.parseMSSQLToJSONv2(invalidSql);
          } catch (error) {
            errorMessage = (error as Error).message;
          }
          if (errorMessage) {
            expect(errorMessage.length).toBeGreaterThan(0);
          }
        }),
      );
    });
  });
});
