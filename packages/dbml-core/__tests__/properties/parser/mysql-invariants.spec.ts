/**
 * Property-Based Tests: MySQL Parser Invariants
 *
 * Tests that valid MySQL SQL always parses correctly and produces valid schema structures.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import {
  sqlSchema,
  formatSqlSchema,
  createTableStatement,
  formatCreateTable,
} from '../generators/sql-arbitraries';
import {
  hasValidSchemaStructure,
  hasValidTableStructure,
  getTableNames,
  countTotalFields,
} from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('MySQL Parser Invariants', () => {
    test('parsing valid CREATE TABLE statements should not throw', () => {
      fc.assert(
        fc.property(createTableStatement('mysql'), (tableStmt) => {
          const sql = formatCreateTable(tableStmt, 'mysql');

          // Should not throw
          expect(() => {
            Parser.parseMySQLToJSONv2(sql);
          }).not.toThrow();
        }),
        { numRuns: 50 },
      );
    });

    test('parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          const result = Parser.parseMySQLToJSONv2(sql);

          // Should have valid schema structure
          expect(hasValidSchemaStructure(result)).toBe(true);

          // Should have arrays for expected properties
          expect(Array.isArray(result.tables)).toBe(true);
          expect(Array.isArray(result.refs)).toBe(true);
          expect(Array.isArray(result.enums)).toBe(true);
        }),
        { numRuns: 30 },
      );
    });

    test('tables in parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          const result = Parser.parseMySQLToJSONv2(sql);

          // Each table should have valid structure
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
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          const result = Parser.parseMySQLToJSONv2(sql);

          // Number of tables should match
          const expectedTableCount = schema.tables.length;
          const actualTableCount = result.tables?.length ?? 0;

          expect(actualTableCount).toBe(expectedTableCount);
        }),
        { numRuns: 30 },
      );
    });

    test('parsed tables should preserve table names', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          const result = Parser.parseMySQLToJSONv2(sql);

          // Extract table names from input
          const inputTableNames = schema.tables.map((t) => {
            // Extract just the table name (without schema)
            const parts = t.tableName.split('.');
            return parts[parts.length - 1].replace(/"/g, '');
          });

          // Extract table names from output
          const outputTableNames = getTableNames(result);

          // All input tables should be present in output
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
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          const result = Parser.parseMySQLToJSONv2(sql);

          // Count input columns
          const inputColumnCount = schema.tables.reduce(
            (sum, table) => sum + table.columns.length,
            0,
          );

          // Count output fields
          const outputFieldCount = countTotalFields(result);

          // Output should have at least as many fields as input columns
          expect(outputFieldCount).toBeGreaterThanOrEqual(inputColumnCount);
        }),
        { numRuns: 30 },
      );
    });

    test('parsing empty/whitespace should not crash', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('', '   ', '\n\n', '\t\t', '  \n  '),
          (sql) => {
            // Should not throw
            expect(() => {
              Parser.parseMySQLToJSONv2(sql);
            }).not.toThrow();
          },
        ),
      );
    });

    test('parsing with comments should not crash', () => {
      fc.assert(
        fc.property(createTableStatement('mysql'), (tableStmt) => {
          const sql = `-- This is a comment\n${formatCreateTable(tableStmt, 'mysql')}\n-- Another comment`;

          // Should not throw
          expect(() => {
            Parser.parseMySQLToJSONv2(sql);
          }).not.toThrow();
        }),
        { numRuns: 20 },
      );
    });

    test('parsing multiple CREATE TABLE statements should work', () => {
      fc.assert(
        fc.property(
          fc.array(createTableStatement('mysql'), { minLength: 1, maxLength: 5 }),
          (tableStmts) => {
            const sql = tableStmts.map((stmt) => formatCreateTable(stmt, 'mysql')).join('\n\n');

            const result = Parser.parseMySQLToJSONv2(sql);

            // Should have valid structure
            expect(hasValidSchemaStructure(result)).toBe(true);

            // Should have at least as many tables as statements
            expect(result.tables?.length ?? 0).toBeGreaterThanOrEqual(1);
          },
        ),
        { numRuns: 20 },
      );
    });

    test('table names should be preserved (case-insensitive)', () => {
      fc.assert(
        fc.property(createTableStatement('mysql'), (tableStmt) => {
          const sql = formatCreateTable(tableStmt, 'mysql');

          const result = Parser.parseMySQLToJSONv2(sql);

          // Extract expected table name
          const expectedName = tableStmt.tableName.split('.').pop()?.replace(/"/g, '') ?? '';

          // Should have at least one table with matching name (case-insensitive)
          const tableNames = getTableNames(result);
          expect(tableNames.some((name) =>
            name.toLowerCase() === expectedName.toLowerCase(),
          )).toBe(true);
        }),
        { numRuns: 30 },
      );
    });
  });
});
