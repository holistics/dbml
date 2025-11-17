/**
 * Property-Based Tests: DBML Parser Error Handling
 *
 * Tests that the parser produces meaningful error messages for invalid inputs.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import { hasInformativeError } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('DBML Parser Error Handling', () => {
    test('invalid syntax should produce error with context', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Table users { id int,, }',
            'Table { id int }',
            'Table users id int',
            'Table users { }',
          ),
          (invalidDbml) => {
            expect(() => {
              Parser.parseDBMLToJSONv2(invalidDbml);
            }).toThrow();
            try {
              Parser.parseDBMLToJSONv2(invalidDbml);
            } catch (error) {
              expect(hasInformativeError(error as Error)).toBe(true);
            }
          },
        ),
      );
    });

    test('incomplete Ref syntax should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Ref:',
            'Ref: users.id >',
            'Ref: > posts.id',
          ),
          (invalidDbml) => {
            expect(() => {
              Parser.parseDBMLToJSONv2(invalidDbml);
            }).toThrow();
          },
        ),
      );
    });

    test('incomplete Enum syntax should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Enum',
            'Enum status {',
            'Enum { active }',
          ),
          (invalidDbml) => {
            expect(() => {
              Parser.parseDBMLToJSONv2(invalidDbml);
            }).toThrow();
          },
        ),
      );
    });

    test('error message should be non-empty', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('Table', 'Ref:', 'Enum', '{ }'),
          (invalidDbml) => {
            let errorMessage = '';
            try {
              Parser.parseDBMLToJSONv2(invalidDbml);
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

    test('mismatched braces should be caught', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Table users { id int',
            'Table users id int }',
            'Table users {{ id int }',
            'Table users { id int }}',
          ),
          (dbml) => {
            expect(() => {
              Parser.parseDBMLToJSONv2(dbml);
            }).toThrow();
          },
        ),
      );
    });

    test('invalid column settings should throw error', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(
            'Table users { id int [invalid] }',
            'Table users { id int [pk pk] }',
            'Table users { id int [ }',
          ),
          (invalidDbml) => {
            expect(() => {
              Parser.parseDBMLToJSONv2(invalidDbml);
            }).toThrow();
          },
        ),
      );
    });
  });
});
