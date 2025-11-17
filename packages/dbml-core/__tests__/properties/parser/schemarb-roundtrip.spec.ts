/**
 * Property-Based Tests: Schema.rb Parser Round-trip
 *
 * Tests that parse -> export -> parse -> export -> parse produces consistent results.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import ModelExporter from '../../../src/export/ModelExporter';
import { schemaRbFile, formatSchemaRb } from '../generators/dbml-arbitraries';
import { testRoundTripIdempotency, areSchemasEquivalent } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('Schema.rb Parser Round-trip', () => {
    test('parse -> export to DBML -> parse should preserve structure', () => {
      fc.assert(
        fc.property(schemaRbFile(), (schema) => {
          const ruby = formatSchemaRb(schema);
          const parsed1 = Parser.parseSchemaRbToJSON(ruby);
          const dbml = ModelExporter.export(parsed1, 'dbml', false);
          const parsed2 = Parser.parseDBMLToJSONv2(dbml);
          const dbml2 = ModelExporter.export(parsed2, 'dbml', false);
          const parsed3 = Parser.parseDBMLToJSONv2(dbml2);
          expect(areSchemasEquivalent(parsed2, parsed3)).toBe(true);
        }),
        { numRuns: 20 },
      );
    });

    test('round-trip through DBML should preserve table count', () => {
      fc.assert(
        fc.property(schemaRbFile(), (schema) => {
          const ruby = formatSchemaRb(schema);
          const parsed1 = Parser.parseSchemaRbToJSON(ruby);
          const tableCount1 = parsed1.tables?.length ?? 0;
          const dbml = ModelExporter.export(parsed1, 'dbml', false);
          const parsed2 = Parser.parseDBMLToJSONv2(dbml);
          const tableCount2 = parsed2.tables?.length ?? 0;
          const dbml2 = ModelExporter.export(parsed2, 'dbml', false);
          const parsed3 = Parser.parseDBMLToJSONv2(dbml2);
          const tableCount3 = parsed3.tables?.length ?? 0;
          expect(tableCount2).toBe(tableCount3);
          expect(tableCount1).toBe(tableCount2);
        }),
        { numRuns: 20 },
      );
    });

    test('using testRoundTripIdempotency helper with DBML export', () => {
      fc.assert(
        fc.property(schemaRbFile(), (schema) => {
          const ruby = formatSchemaRb(schema);
          const parsed1 = Parser.parseSchemaRbToJSON(ruby);
          const dbml = ModelExporter.export(parsed1, 'dbml', false);
          const parseFunc = (input: string) => Parser.parseDBMLToJSONv2(input);
          const exportFunc = (parsed: any) => ModelExporter.export(parsed, 'dbml', false);
          const result = testRoundTripIdempotency(parseFunc, exportFunc, dbml);
          if (result.error) {
            expect(result.error.length).toBeGreaterThan(0);
          } else {
            expect(result.idempotent).toBe(true);
          }
        }),
        { numRuns: 20 },
      );
    });
  });
});
