/**
 * Property-Based Tests: Schema.rb Parser Invariants
 *
 * Tests that valid Ruby on Rails Schema.rb always parses correctly and produces valid schema structures.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { schemaRbFile, formatSchemaRb, railsTable, formatRailsTable } from '../generators/dbml-arbitraries';
import { hasValidSchemaStructure, hasValidTableStructure, getTableNames } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('Schema.rb Parser Invariants', () => {
    test('parsing valid schema.rb files should not throw', () => {
      fc.assert(
        fc.property(schemaRbFile(), (schema) => {
          const ruby = formatSchemaRb(schema);
          expect(() => {
            Parser.parseSchemaRbToJSON(ruby);
          }).not.toThrow();
        }),
        { numRuns: 50 },
      );
    });

    test('parsing individual table definitions should work', () => {
      fc.assert(
        fc.property(railsTable(), (table) => {
          const ruby = `ActiveRecord::Schema.define(version: 20250101000000) do\n${formatRailsTable(table)}\nend`;
          expect(() => {
            Parser.parseSchemaRbToJSON(ruby);
          }).not.toThrow();
        }),
        { numRuns: 30 },
      );
    });

    test('parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(schemaRbFile(), (schema) => {
          const ruby = formatSchemaRb(schema);
          const result = Parser.parseSchemaRbToJSON(ruby);
          expect(hasValidSchemaStructure(result)).toBe(true);
          expect(Array.isArray(result.tables)).toBe(true);
        }),
        { numRuns: 30 },
      );
    });

    test('tables in parsed schema should have valid structure', () => {
      fc.assert(
        fc.property(schemaRbFile(), (schema) => {
          const ruby = formatSchemaRb(schema);
          const result = Parser.parseSchemaRbToJSON(ruby);
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
        fc.property(schemaRbFile(), (schema) => {
          const ruby = formatSchemaRb(schema);
          const result = Parser.parseSchemaRbToJSON(ruby);
          const expectedTableCount = schema.tables.length;
          const actualTableCount = result.tables?.length ?? 0;
          expect(actualTableCount).toBe(expectedTableCount);
        }),
        { numRuns: 30 },
      );
    });

    test('parsed tables should preserve table names', () => {
      fc.assert(
        fc.property(schemaRbFile(), (schema) => {
          const ruby = formatSchemaRb(schema);
          const result = Parser.parseSchemaRbToJSON(ruby);
          const inputTableNames = schema.tables.map((t) => t.name);
          const outputTableNames = getTableNames(result);
          for (const tableName of inputTableNames) {
            expect(outputTableNames.some((name) => name === tableName)).toBe(true);
          }
        }),
        { numRuns: 30 },
      );
    });

    test('parsing empty/whitespace should not crash', () => {
      fc.assert(
        fc.property(fc.constantFrom('', '   ', '\n\n', '\t\t', '  \n  '), (ruby) => {
          expect(() => {
            Parser.parseSchemaRbToJSON(ruby);
          }).not.toThrow();
        }),
      );
    });

    test('parsing with comments should not crash', () => {
      fc.assert(
        fc.property(railsTable(), (table) => {
          const ruby = `# This is a comment\nActiveRecord::Schema.define(version: 20250101000000) do\n${formatRailsTable(table)}\nend\n# Another comment`;
          expect(() => {
            Parser.parseSchemaRbToJSON(ruby);
          }).not.toThrow();
        }),
        { numRuns: 20 },
      );
    });

    test('parsing common Rails column types should work', () => {
      const ruby = `
        ActiveRecord::Schema.define(version: 20250101000000) do
          create_table :users do |t|
            t.string :name
            t.integer :age
            t.boolean :active
            t.datetime :created_at
            t.text :bio
            t.json :metadata
          end
        end
      `;
      const result = Parser.parseSchemaRbToJSON(ruby);
      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.tables?.length).toBeGreaterThan(0);
    });

    test('parsing indexes should work', () => {
      const ruby = `
        ActiveRecord::Schema.define(version: 20250101000000) do
          create_table :users do |t|
            t.string :email
          end
          add_index :users, :email, unique: true
        end
      `;
      const result = Parser.parseSchemaRbToJSON(ruby);
      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.tables?.length).toBeGreaterThan(0);
    });

    test('parsing timestamps should work', () => {
      const ruby = `
        ActiveRecord::Schema.define(version: 20250101000000) do
          create_table :posts do |t|
            t.string :title
            t.timestamps
          end
        end
      `;
      const result = Parser.parseSchemaRbToJSON(ruby);
      expect(hasValidSchemaStructure(result)).toBe(true);
      expect(result.tables?.length).toBeGreaterThan(0);
    });
  });
});
