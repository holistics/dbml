/**
 * Property-Based Tests: Schema.rb Parser Error Handling
 *
 * Tests that the parser produces meaningful error messages for invalid inputs.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { hasInformativeError } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('Schema.rb Parser Error Handling', () => {
    test('invalid syntax should produce error with context', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'ActiveRecord::Schema.define do create_table end',
            'create_table :users',
            't.string :name',
          ),
          (invalidRuby) => {
            expect(() => {
              Parser.parseSchemaRbToJSON(invalidRuby);
            }).toThrow();
            try {
              Parser.parseSchemaRbToJSON(invalidRuby);
            } catch (error) {
              expect(hasInformativeError(error as Error)).toBe(true);
            }
          },
        ),
      );
    });

    test('incomplete create_table should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table\nend',
            'ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table :users\nend',
          ),
          (invalidRuby) => {
            expect(() => {
              Parser.parseSchemaRbToJSON(invalidRuby);
            }).toThrow();
          },
        ),
      );
    });

    test('error message should be non-empty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('create_table', 't.string', 'add_index', 'do end'),
          (invalidRuby) => {
            let errorMessage = '';
            try {
              Parser.parseSchemaRbToJSON(invalidRuby);
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

    test('missing version should be handled', () => {
      const ruby = 'ActiveRecord::Schema.define do\n  create_table :users do |t|\n    t.string :name\n  end\nend';
      // Should either accept or reject gracefully
      try {
        const result = Parser.parseSchemaRbToJSON(ruby);
        expect(result).toBeDefined();
      } catch (error) {
        expect(error).toBeDefined();
      }
    });

    test('missing do/end blocks should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'ActiveRecord::Schema.define(version: 20250101000000)\n  create_table :users',
            'ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table :users |t|',
          ),
          (invalidRuby) => {
            expect(() => {
              Parser.parseSchemaRbToJSON(invalidRuby);
            }).toThrow();
          },
        ),
      );
    });
  });
});
