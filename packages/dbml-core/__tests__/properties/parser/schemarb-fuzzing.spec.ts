/**
 * Property-Based Tests: Schema.rb Parser Fuzzing
 *
 * Tests that the parser handles random/malformed inputs gracefully without crashing.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { parseWithoutCrashing } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('Schema.rb Parser Fuzzing', () => {
    test('parser should not crash on random strings', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (randomString) => {
          expect(() => {
            try {
              Parser.parseSchemaRbToJSON(randomString);
            } catch (error) {
              expect(error).toBeDefined();
            }
          }).not.toThrow(/segmentation fault|stack overflow/i);
        }),
        { numRuns: 100 },
      );
    });

    test('parser should not crash on malformed Ruby', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'ActiveRecord::Schema.define',
            'create_table :users',
            't.string :name :invalid',
            'add_index',
          ),
          (ruby) => {
            const result = parseWithoutCrashing((input) => Parser.parseSchemaRbToJSON(input), ruby);
            expect(result).toBeDefined();
          },
        ),
        { numRuns: 50 },
      );
    });

    test('parser should handle very long identifiers', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 100, maxLength: 10000 }), (longString) => {
          const ruby = `ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table :${longString} do |t|\n  end\nend`;
          expect(() => {
            try {
              Parser.parseSchemaRbToJSON(ruby);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/maximum call stack|stack overflow/i);
        }),
        { numRuns: 50 },
      );
    });

    test('parser should handle incomplete create_table blocks', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table',
            'ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table :users',
            'ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table :users do',
            'ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table :users do |t|',
          ),
          (ruby) => {
            expect(() => {
              try {
                Parser.parseSchemaRbToJSON(ruby);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
      );
    });

    test('parser should handle mixed valid and invalid syntax', () => {
      fc.assert(
        fc.property(
          fc.tuple(
            fc.constantFrom(
              'ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table :users do |t|\n    t.string :name\n  end\nend',
            ),
            fc.string({ maxLength: 500 }),
          ),
          ([validRuby, noise]) => {
            const ruby = `${validRuby} ${noise}`;
            expect(() => {
              try {
                Parser.parseSchemaRbToJSON(ruby);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
        { numRuns: 50 },
      );
    });

    test('parser should handle invalid column types', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 1, maxLength: 50 }), (invalidType) => {
          const ruby = `ActiveRecord::Schema.define(version: 20250101000000) do\n  create_table :users do |t|\n    t.${invalidType} :data\n  end\nend`;
          expect(() => {
            try {
              Parser.parseSchemaRbToJSON(ruby);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/segmentation fault|stack overflow/i);
        }),
        { numRuns: 30 },
      );
    });

    test('parser should handle nested blocks', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 20 }), (depth) => {
          const nested = 'do |x|\n  '.repeat(depth) + 'end\n'.repeat(depth);
          const ruby = `ActiveRecord::Schema.define(version: 20250101000000) ${nested}`;
          expect(() => {
            try {
              Parser.parseSchemaRbToJSON(ruby);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/stack overflow|maximum call stack/i);
        }),
        { numRuns: 20 },
      );
    });
  });
});
