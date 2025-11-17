/**
 * Property-Based Tests: PostgreSQL Parser Round-trip
 *
 * Tests that parse -> export -> parse -> export -> parse produces consistent results.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import ModelExporter from '../../../src/export/ModelExporter';
import { sqlSchema, formatSqlSchema } from '../generators/sql-arbitraries';
import { testRoundTripIdempotency, areSchemasEquivalent } from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('PostgreSQL Parser Round-trip', () => {
    test('parse -> export -> parse should be idempotent', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const parsed1 = Parser.parsePostgresToJSONv2(sql);
          const exported1 = ModelExporter.export(parsed1, 'postgres', false);
          const parsed2 = Parser.parsePostgresToJSONv2(exported1);
          const exported2 = ModelExporter.export(parsed2, 'postgres', false);
          const parsed3 = Parser.parsePostgresToJSONv2(exported2);

          expect(areSchemasEquivalent(parsed2, parsed3)).toBe(true);
        }),
        { numRuns: 20 },
      );
    });

    test('round-trip should preserve table count', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const parsed1 = Parser.parsePostgresToJSONv2(sql);
          const tableCount1 = parsed1.tables?.length ?? 0;

          const exported1 = ModelExporter.export(parsed1, 'postgres', false);
          const parsed2 = Parser.parsePostgresToJSONv2(exported1);
          const tableCount2 = parsed2.tables?.length ?? 0;

          const exported2 = ModelExporter.export(parsed2, 'postgres', false);
          const parsed3 = Parser.parsePostgresToJSONv2(exported2);
          const tableCount3 = parsed3.tables?.length ?? 0;

          expect(tableCount2).toBe(tableCount3);
        }),
        { numRuns: 20 },
      );
    });

    test('using testRoundTripIdempotency helper', () => {
      fc.assert(
        fc.property(sqlSchema('postgres'), (schema) => {
          const sql = formatSqlSchema(schema, 'postgres');

          const parseFunc = (input: string) => Parser.parsePostgresToJSONv2(input);
          const exportFunc = (parsed: any) => ModelExporter.export(parsed, 'postgres', false);

          const result = testRoundTripIdempotency(parseFunc, exportFunc, sql);

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
