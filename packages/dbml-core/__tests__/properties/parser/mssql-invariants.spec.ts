/**
 * Property-Based Tests: MSSQL Parser Invariants
 *
 * Tests that valid MSSQL SQL always parses correctly and produces valid schema structures.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { sqlSchema, formatSqlSchema, createTableStatement, formatCreateTable } from '../generators/sql-arbitraries';
import { hasValidSchemaStructure, hasValidTableStructure, getTableNames, countTotalFields } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('MSSQL Parser Invariants', () => {
    test('parsing valid CREATE TABLE statements should not throw', () => {
      fc.assert(
        fc.property(createTableStatement('mssql'), (tableStmt) => {
          const sql = formatCreateTable(tableStmt, 'mssql');
          expect(() => {
            Parser.parseMSSQLToJSONv2(sql);
          }).not.toThrow();
        }),
        { numRuns: 50 },
      );
    });

    test('parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(sqlSchema('mssql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mssql');
          const result = Parser.parseMSSQLToJSONv2(sql);
          expect(hasValidSchemaStructure(result)).toBe(true);
          expect(Array.isArray(result.tables)).toBe(true);
          expect(Array.isArray(result.refs)).toBe(true);
          expect(Array.isArray(result.enums)).toBe(true);
        }),
        { numRuns: 30 },
      );
    });

    test('tables in parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(sqlSchema('mssql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mssql');
          const result = Parser.parseMSSQLToJSONv2(sql);
          if (result.tables && result.tables.length > 0) {
            for (const table of result.tables) {
              expect(hasValidTableStructure(table)).toBe(true);
            }
          }
        }),
        { numRuns: 30 },
      );
    });

    test('number of parsed tables should match input', () => {
      fc.assert(
        fc.property(sqlSchema('mssql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mssql');
          const result = Parser.parseMSSQLToJSONv2(sql);
          const expectedTableCount = schema.tables.length;
          const actualTableCount = result.tables?.length ?? 0;
          expect(actualTableCount).toBe(expectedTableCount);
        }),
        { numRuns: 30 },
      );
    });

    test('parsed tables should preserve table names', () => {
      fc.assert(
        fc.property(sqlSchema('mssql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mssql');
          const result = Parser.parseMSSQLToJSONv2(sql);
          const inputTableNames = schema.tables.map((t) => {
            const parts = t.tableName.split('.');
            return parts[parts.length - 1].replace(/"/g, '');
          });
          const outputTableNames = getTableNames(result);
          for (const tableName of inputTableNames) {
            expect(outputTableNames.some((name) =>
              name.toLowerCase() === tableName.toLowerCase(),
            )).toBe(true);
          }
        }),
        { numRuns: 30 },
      );
    });

    test('parsed tables should have at least as many fields as input columns', () => {
      fc.assert(
        fc.property(sqlSchema('mssql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mssql');
          const result = Parser.parseMSSQLToJSONv2(sql);
          const inputColumnCount = schema.tables.reduce((sum, table) => sum + table.columns.length, 0);
          const outputFieldCount = countTotalFields(result);
          expect(outputFieldCount).toBeGreaterThanOrEqual(inputColumnCount);
        }),
        { numRuns: 30 },
      );
    });

    test('parsing empty/whitespace should not crash', () => {
      fc.assert(
        fc.property(fc.constantFrom('', '   ', '\n\n', '\t\t', '  \n  '), (sql) => {
          expect(() => {
            Parser.parseMSSQLToJSONv2(sql);
          }).not.toThrow();
        }),
      );
    });

    test('MSSQL IDENTITY should be handled', () => {
      const sql = 'CREATE TABLE users (id INT IDENTITY(1,1) PRIMARY KEY, name NVARCHAR(255));';
      const result = Parser.parseMSSQLToJSONv2(sql);
      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.tables?.length).toBeGreaterThan(0);
    });

    test('MSSQL UNIQUEIDENTIFIER should be handled', () => {
      const sql = 'CREATE TABLE users (id UNIQUEIDENTIFIER, name NVARCHAR(255));';
      const result = Parser.parseMSSQLToJSONv2(sql);
      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.tables?.length).toBeGreaterThan(0);
    });
  });
});
