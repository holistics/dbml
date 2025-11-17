/**
 * Property-Based Tests: DBML Parser Invariants
 *
 * Tests that valid DBML always parses correctly and produces valid schema structures.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { dbmlSchema, formatDbmlSchema, dbmlTable, formatDbmlTable } from '../generators/dbml-arbitraries';
import { hasValidSchemaStructure, hasValidTableStructure, getTableNames, getEnumNames } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('DBML Parser Invariants', () => {
    test('parsing valid table definitions should not throw', () => {
      fc.assert(
        fc.property(dbmlTable(), (table) => {
          const dbml = formatDbmlTable(table);
          expect(() => {
            Parser.parseDBMLToJSONv2(dbml);
          }).not.toThrow();
        }),
        { numRuns: 50 },
      );
    });

    test('parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
          const result = Parser.parseDBMLToJSONv2(dbml);
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
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
          const result = Parser.parseDBMLToJSONv2(dbml);
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
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
          const result = Parser.parseDBMLToJSONv2(dbml);
          const expectedTableCount = schema.tables.length;
          const actualTableCount = result.tables?.length ?? 0;
          expect(actualTableCount).toBe(expectedTableCount);
        }),
        { numRuns: 30 },
      );
    });

    test('number of parsed enums should match input', () => {
      fc.assert(
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
          const result = Parser.parseDBMLToJSONv2(dbml);
          const expectedEnumCount = schema.enums?.length ?? 0;
          const actualEnumCount = result.enums?.length ?? 0;
          expect(actualEnumCount).toBe(expectedEnumCount);
        }),
        { numRuns: 30 },
      );
    });

    test('parsed tables should preserve table names', () => {
      fc.assert(
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
          const result = Parser.parseDBMLToJSONv2(dbml);
          const inputTableNames = schema.tables.map((t) => t.name.replace(/"/g, ''));
          const outputTableNames = getTableNames(result);
          for (const tableName of inputTableNames) {
            expect(outputTableNames.some((name) => name === tableName)).toBe(true);
          }
        }),
        { numRuns: 30 },
      );
    });

    test('parsed enums should preserve enum names', () => {
      fc.assert(
        fc.property(dbmlSchema(), (schema) => {
          if (!schema.enums || schema.enums.length === 0) {
            return true; // Skip if no enums
          }
          const dbml = formatDbmlSchema(schema);
          const result = Parser.parseDBMLToJSONv2(dbml);
          const inputEnumNames = schema.enums.map((e) => e.name.replace(/"/g, ''));
          const outputEnumNames = getEnumNames(result);
          for (const enumName of inputEnumNames) {
            expect(outputEnumNames.some((name) => name === enumName)).toBe(true);
          }
        }),
        { numRuns: 30 },
      );
    });

    test('parsing empty/whitespace should not crash', () => {
      fc.assert(
        fc.property(fc.constantFrom('', '   ', '\n\n', '\t\t', '  \n  '), (dbml) => {
          expect(() => {
            Parser.parseDBMLToJSONv2(dbml);
          }).not.toThrow();
        }),
      );
    });

    test('parsing with comments should not crash', () => {
      fc.assert(
        fc.property(dbmlTable(), (table) => {
          const dbml = `// This is a comment\n${formatDbmlTable(table)}\n// Another comment`;
          expect(() => {
            Parser.parseDBMLToJSONv2(dbml);
          }).not.toThrow();
        }),
        { numRuns: 20 },
      );
    });

    test('parsing project block should work', () => {
      const dbml = `
        Project MyProject {
          Note: 'A simple project'
        }

        Table users {
          id int [pk]
          name varchar
        }
      `;
      const result = Parser.parseDBMLToJSONv2(dbml);
      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.project).toBeDefined();
    });

    test('parsing relationships should work', () => {
      const dbml = `
        Table users {
          id int [pk]
        }

        Table posts {
          id int [pk]
          user_id int
        }

        Ref: posts.user_id > users.id
      `;
      const result = Parser.parseDBMLToJSONv2(dbml);
      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.refs?.length).toBeGreaterThan(0);
    });

    test('parsing indexes should work', () => {
      const dbml = `
        Table users {
          id int [pk]
          email varchar

          indexes {
            email [unique]
            (id, email) [name: 'composite_idx']
          }
        }
      `;
      const result = Parser.parseDBMLToJSONv2(dbml);
      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.tables?.length).toBeGreaterThan(0);
      expect(result.tables?.[0].indexes).toBeDefined();
    });
  });
});
