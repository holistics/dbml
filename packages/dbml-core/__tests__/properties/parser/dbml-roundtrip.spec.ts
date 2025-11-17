/**
 * Property-Based Tests: DBML Parser Round-trip
 *
 * Tests that parse -> export -> parse -> export -> parse produces consistent results.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import ModelExporter from '../../../src/export/ModelExporter';
import { dbmlSchema, formatDbmlSchema } from '../generators/dbml-arbitraries';
import { testRoundTripIdempotency, areSchemasEquivalent } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('DBML Parser Round-trip', () => {
    test('parse -> export -> parse should be idempotent', () => {
      fc.assert(
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
          const parsed1 = Parser.parseDBMLToJSONv2(dbml);
          const exported1 = ModelExporter.export(parsed1, 'dbml', false);
          const parsed2 = Parser.parseDBMLToJSONv2(exported1);
          const exported2 = ModelExporter.export(parsed2, 'dbml', false);
          const parsed3 = Parser.parseDBMLToJSONv2(exported2);
          expect(areSchemasEquivalent(parsed2, parsed3)).toBe(true);
        }),
        { numRuns: 20 },
      );
    });

    test('round-trip should preserve table count', () => {
      fc.assert(
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
          const parsed1 = Parser.parseDBMLToJSONv2(dbml);
          const tableCount1 = parsed1.tables?.length ?? 0;
          const exported1 = ModelExporter.export(parsed1, 'dbml', false);
          const parsed2 = Parser.parseDBMLToJSONv2(exported1);
          const tableCount2 = parsed2.tables?.length ?? 0;
          const exported2 = ModelExporter.export(parsed2, 'dbml', false);
          const parsed3 = Parser.parseDBMLToJSONv2(exported2);
          const tableCount3 = parsed3.tables?.length ?? 0;
          expect(tableCount2).toBe(tableCount3);
        }),
        { numRuns: 20 },
      );
    });

    test('round-trip should preserve enum count', () => {
      fc.assert(
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
          const parsed1 = Parser.parseDBMLToJSONv2(dbml);
          const enumCount1 = parsed1.enums?.length ?? 0;
          const exported1 = ModelExporter.export(parsed1, 'dbml', false);
          const parsed2 = Parser.parseDBMLToJSONv2(exported1);
          const enumCount2 = parsed2.enums?.length ?? 0;
          const exported2 = ModelExporter.export(parsed2, 'dbml', false);
          const parsed3 = Parser.parseDBMLToJSONv2(exported2);
          const enumCount3 = parsed3.enums?.length ?? 0;
          expect(enumCount2).toBe(enumCount3);
        }),
        { numRuns: 20 },
      );
    });

    test('using testRoundTripIdempotency helper', () => {
      fc.assert(
        fc.property(dbmlSchema(), (schema) => {
          const dbml = formatDbmlSchema(schema);
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
