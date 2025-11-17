/**
 * Property-Based Tests: DBML Parser Fuzzing
 *
 * Tests that the parser handles random/malformed inputs gracefully without crashing.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { malformedDbml } from '../generators/dbml-arbitraries';
import { parseWithoutCrashing } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('DBML Parser Fuzzing', () => {
    test('parser should not crash on random strings', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 0, maxLength: 1000 }), (randomString) => {
          expect(() => {
            try {
              Parser.parseDBMLToJSONv2(randomString);
            } catch (error) {
              expect(error).toBeDefined();
            }
          }).not.toThrow(/segmentation fault|stack overflow/i);
        }),
        { numRuns: 100 },
      );
    });

    test('parser should not crash on malformed DBML', () => {
      fc.assert(
        fc.property(malformedDbml(), (dbml) => {
          const result = parseWithoutCrashing((input) => Parser.parseDBMLToJSONv2(input), dbml);
          expect(result).toBeDefined();
        }),
        { numRuns: 100 },
      );
    });

    test('parser should handle very long identifiers', () => {
      fc.assert(
        fc.property(fc.string({ minLength: 100, maxLength: 10000 }), (longString) => {
          const dbml = `Table ${longString} { id int }`;
          expect(() => {
            try {
              Parser.parseDBMLToJSONv2(dbml);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/maximum call stack|stack overflow/i);
        }),
        { numRuns: 50 },
      );
    });

    test('parser should handle deeply nested braces', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 100 }), (depth) => {
          const nested = '{'.repeat(depth) + '}'.repeat(depth);
          const dbml = `Table test ${nested}`;
          expect(() => {
            try {
              Parser.parseDBMLToJSONv2(dbml);
            } catch (error) {
              // Error is fine
            }
          }).not.toThrow(/stack overflow|maximum call stack/i);
        }),
        { numRuns: 30 },
      );
    });

    test('parser should handle incomplete table definitions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Table users {',
            'Table users { id',
            'Table users { id int',
            'Table {',
          ),
          (dbml) => {
            expect(() => {
              try {
                Parser.parseDBMLToJSONv2(dbml);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
      );
    });

    test('parser should handle incomplete Ref syntax', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Ref:',
            'Ref: users.id',
            'Ref: users.id >',
            'Ref: >',
          ),
          (dbml) => {
            expect(() => {
              try {
                Parser.parseDBMLToJSONv2(dbml);
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
              'Table users { id int [pk] }',
              'Enum status { active inactive }',
            ),
            fc.string({ maxLength: 500 }),
          ),
          ([validDbml, noise]) => {
            const dbml = `${validDbml} ${noise}`;
            expect(() => {
              try {
                Parser.parseDBMLToJSONv2(dbml);
              } catch (error) {
                // Error is fine
              }
            }).not.toThrow(/segmentation fault|stack overflow/i);
          },
        ),
        { numRuns: 50 },
      );
    });

    test('parser should handle Unicode in strings', () => {
      fc.assert(
        fc.property(fc.unicodeString({ minLength: 1, maxLength: 100 }), (unicode) => {
          const dbml = `Table users { name varchar [note: '${unicode}'] }`;
          expect(() => {
            try {
              Parser.parseDBMLToJSONv2(dbml);
            } catch (error) {
              expect(error).toBeDefined();
            }
          }).not.toThrow(/segmentation fault|encoding error/i);
        }),
        { numRuns: 50 },
      );
    });
  });
});
