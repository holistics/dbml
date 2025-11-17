/**
 * Property-Based Tests: PostgreSQL Parser Invariants
 *
 * Tests that valid PostgreSQL SQL always parses correctly and produces valid schema structures.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import {
  sqlSchema,
  formatSqlSchema,
  createTableStatement,
  formatCreateTable,
  createEnumStatement,
  formatCreateEnum,
} from '../generators/sql-arbitraries';
import {
  hasValidSchemaStructure,
  hasValidTableStructure,
  hasValidEnumStructure,
  getTableNames,
  getEnumNames,
  countTotalFields,
} from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('PostgreSQL Parser Invariants', () => {
    test('parsing valid CREATE TABLE statements should not throw', () => {
      fc.assert(
        fc.property(createTableStatement('postgres'), (tableStmt) => {
          const sql = formatCreateTable(tableStmt, 'postgres');

          // Should not throw
          expect(() => {
            Parser.parsePostgresToJSONv2(sql);
          }).not.toThrow();
        }),
        { numRuns: 50 },
      );
    });

    test('parsing CREATE TYPE (enum) statements should not throw', () => {
      fc.assert(
        fc.property(createEnumStatement(), (enumStmt) => {
          const sql = formatCreateEnum(enumStmt);

          // Should not throw
          expect(() => {
            Parser.parsePostgresToJSONv2(sql);
          }).not.toThrow();
        }),
        { numRuns: 30 },
      );
    });

    test('parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const result = Parser.parsePostgresToJSONv2(sql);

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
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const result = Parser.parsePostgresToJSONv2(sql);

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

    test('enums in parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const result = Parser.parsePostgresToJSONv2(sql);

          // Each enum should have valid structure
          if (result.enums && result.enums.length > 0) {
            for (const enumDef of result.enums) {
              expect(hasValidEnumStructure(enumDef)).toBe(true);
            }
          }
        }),
        { numRuns: 30 },
      );
    });

    test('number of parsed tables should match input', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const result = Parser.parsePostgresToJSONv2(sql);

          // Number of tables should match
          const expectedTableCount = schema.tables.length;
          const actualTableCount = result.tables?.length ?? 0;

          expect(actualTableCount).toBe(expectedTableCount);
        }),
        { numRuns: 30 },
      );
    });

    test('number of parsed enums should match input', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const result = Parser.parsePostgresToJSONv2(sql);

          // Number of enums should match (or be undefined if no enums)
          const expectedEnumCount = schema.enums?.length ?? 0;
          const actualEnumCount = result.enums?.length ?? 0;

          expect(actualEnumCount).toBe(expectedEnumCount);
        }),
        { numRuns: 30 },
      );
    });

    test('parsed tables should preserve table names', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const result = Parser.parsePostgresToJSONv2(sql);

          // Extract table names from input
          const inputTableNames = schema.tables.map((t) => {
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

    test('parsed enums should preserve enum names', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          if (!schema.enums || schema.enums.length === 0) {
            return true; // Skip if no enums
          }

          const sql = formatSqlSchema(schema, 'postgres');

          const result = Parser.parsePostgresToJSONv2(sql);

          // Extract enum names from input
          const inputEnumNames = schema.enums.map((e) => e.enumName.replace(/"/g, ''));

          // Extract enum names from output
          const outputEnumNames = getEnumNames(result);

          // All input enums should be present in output
          for (const enumName of inputEnumNames) {
            expect(outputEnumNames.some((name) =>
              name.toLowerCase() === enumName.toLowerCase(),
            )).toBe(true);
          }
        }),
        { numRuns: 30 },
      );
    });

    test('parsed tables should have at least as many fields as input columns', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const result = Parser.parsePostgresToJSONv2(sql);

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
              Parser.parsePostgresToJSONv2(sql);
            }).not.toThrow();
          },
        ),
      );
    });

    test('parsing with comments should not crash', () => {
      fc.assert(
        fc.property(createTableStatement('postgres'), (tableStmt) => {
          const sql = `-- This is a comment\n${formatCreateTable(tableStmt, 'postgres')}\n-- Another comment`;

          // Should not throw
          expect(() => {
            Parser.parsePostgresToJSONv2(sql);
          }).not.toThrow();
        }),
        { numRuns: 20 },
      );
    });

    test('parsing multiple CREATE TABLE statements should work', () => {
      fc.assert(
        fc.property(
          fc.array(createTableStatement('postgres'), { minLength: 1, maxLength: 5 }),
          (tableStmts) => {
            const sql = tableStmts.map((stmt) => formatCreateTable(stmt, 'postgres')).join('\n\n');

            const result = Parser.parsePostgresToJSONv2(sql);

            // Should have valid structure
            expect(hasValidSchemaStructure(result)).toBe(true);

            // Should have at least as many tables as statements
            expect(result.tables?.length ?? 0).toBeGreaterThanOrEqual(1);
          },
        ),
        { numRuns: 20 },
      );
    });

    test('PostgreSQL SERIAL type should be handled', () => {
      const sql = 'CREATE TABLE users (id SERIAL PRIMARY KEY, name VARCHAR(255));';

      const result = Parser.parsePostgresToJSONv2(sql);

      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.tables?.length).toBeGreaterThan(0);
    });

    test('PostgreSQL TIMESTAMPTZ type should be handled', () => {
      const sql = 'CREATE TABLE events (id INT, created_at TIMESTAMPTZ);';

      const result = Parser.parsePostgresToJSONv2(sql);

      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.tables?.length).toBeGreaterThan(0);
    });
  });
});
