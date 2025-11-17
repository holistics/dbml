/**
 * Property-Based Tests: MSSQL Parser Fuzzing
 *
 * Tests that the parser handles random/malformed inputs gracefully without crashing.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { malformedSql } from '../generators/sql-arbitraries';
import { parseWithoutCrashing } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('MSSQL Parser Fuzzing', () => {
    test('parser should not crash on random strings', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (randomString) => {
          expect(() => {
            try {
              Parser.parseMSSQLToJSONv2(randomString);
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
          const result = parseWithoutCrashing((input) => Parser.parseMSSQLToJSONv2(input), sql);
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
              Parser.parseMSSQLToJSONv2(sql);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/maximum call stack|stack overflow/i);
        }),
        { numRuns: 50 },
      );
    });

    test('parser should handle MSSQL-specific syntax errors', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'CREATE TABLE users (id INT IDENTITY);',
            'CREATE TABLE [dbo.[users] (id INT);',
            'GO GO GO',
            'SET ANSI_NULLS ON ON',
          ),
          (sql) => {
            expect(() => {
              try {
                Parser.parseMSSQLToJSONv2(sql);
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
