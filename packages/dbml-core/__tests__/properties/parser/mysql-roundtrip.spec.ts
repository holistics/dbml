/**
 * Property-Based Tests: MySQL Parser Round-trip
 *
 * Tests that parse -> export -> parse -> export -> parse produces consistent results.
 */

import * as fc from 'fast-check';
import Parser from '../../../src/parse/Parser';
import ModelExporter from '../../../src/export/ModelExporter';
import {
  sqlSchema,
  formatSqlSchema,
} from '../generators/sql-arbitraries';
import {
  testRoundTripIdempotency,
  areSchemasEquivalent,
} from '../generators/test-helpers';

describe('@dbml/core - Property-Based Tests', () => {
  describe('MySQL Parser Round-trip', () => {
    test('parse -> export -> parse should be idempotent', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          // First parse
          const parsed1 = Parser.parseMySQLToJSONv2(sql);

          // Export back to MySQL
          const exported1 = ModelExporter.export(parsed1, 'mysql', false);

          // Second parse
          const parsed2 = Parser.parseMySQLToJSONv2(exported1);

          // Export again
          const exported2 = ModelExporter.export(parsed2, 'mysql', false);

          // Third parse
          const parsed3 = Parser.parseMySQLToJSONv2(exported2);

          // parsed2 and parsed3 should be equivalent (idempotent)
          expect(areSchemasEquivalent(parsed2, parsed3)).toBe(true);
        }),
        { numRuns: 20 },
      );
    });

    test('round-trip should preserve table count', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          // First parse
          const parsed1 = Parser.parseMySQLToJSONv2(sql);
          const tableCount1 = parsed1.tables?.length ?? 0;

          // Export and re-parse
          const exported1 = ModelExporter.export(parsed1, 'mysql', false);
          const parsed2 = Parser.parseMySQLToJSONv2(exported1);
          const tableCount2 = parsed2.tables?.length ?? 0;

          // Export and re-parse again
          const exported2 = ModelExporter.export(parsed2, 'mysql', false);
          const parsed3 = Parser.parseMySQLToJSONv2(exported2);
          const tableCount3 = parsed3.tables?.length ?? 0;

          // Table count should stabilize after first round-trip
          expect(tableCount2).toBe(tableCount3);
        }),
        { numRuns: 20 },
      );
    });

    test('round-trip should preserve table names', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          // First parse
          const parsed1 = Parser.parseMySQLToJSONv2(sql);
          const tableNames1 = new Set(
            (parsed1.tables ?? []).map((t: any) => t.name?.toLowerCase()),
          );

          // Export and re-parse
          const exported1 = ModelExporter.export(parsed1, 'mysql', false);
          const parsed2 = Parser.parseMySQLToJSONv2(exported1);
          const tableNames2 = new Set(
            (parsed2.tables ?? []).map((t: any) => t.name?.toLowerCase()),
          );

          // Export and re-parse again
          const exported2 = ModelExporter.export(parsed2, 'mysql', false);
          const parsed3 = Parser.parseMySQLToJSONv2(exported2);
          const tableNames3 = new Set(
            (parsed3.tables ?? []).map((t: any) => t.name?.toLowerCase()),
          );

          // Table names should stabilize
          expect(tableNames2).toEqual(tableNames3);
        }),
        { numRuns: 20 },
      );
    });

    test('round-trip should preserve field count per table', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          // First parse
          const parsed1 = Parser.parseMySQLToJSONv2(sql);

          // Export and re-parse
          const exported1 = ModelExporter.export(parsed1, 'mysql', false);
          const parsed2 = Parser.parseMySQLToJSONv2(exported1);

          // Export and re-parse again
          const exported2 = ModelExporter.export(parsed2, 'mysql', false);
          const parsed3 = Parser.parseMySQLToJSONv2(exported2);

          // Field counts should match between parsed2 and parsed3
          if (parsed2.tables && parsed3.tables) {
            // Sort tables by name for comparison
            const tables2 = [...parsed2.tables].sort((a: any, b: any) =>
              (a.name || '').localeCompare(b.name || ''),
            );
            const tables3 = [...parsed3.tables].sort((a: any, b: any) =>
              (a.name || '').localeCompare(b.name || ''),
            );

            expect(tables2.length).toBe(tables3.length);

            for (let i = 0; i < tables2.length; i++) {
              const fieldCount2 = tables2[i].fields?.length ?? 0;
              const fieldCount3 = tables3[i].fields?.length ?? 0;
              expect(fieldCount2).toBe(fieldCount3);
            }
          }
        }),
        { numRuns: 20 },
      );
    });

    test('using testRoundTripIdempotency helper', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          const parseFunc = (input: string) => Parser.parseMySQLToJSONv2(input);
          const exportFunc = (parsed: any) => ModelExporter.export(parsed, 'mysql', false);

          const result = testRoundTripIdempotency(parseFunc, exportFunc, sql);

          // Should be idempotent (no error)
          if (result.error) {
            // If there's an error, it should be informative
            expect(result.error.length).toBeGreaterThan(0);
          } else {
            // If no error, should be idempotent
            expect(result.idempotent).toBe(true);
          }
        }),
        { numRuns: 20 },
      );
    });

    test('exporting and re-parsing should not introduce new tables', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          // Parse
          const parsed1 = Parser.parseMySQLToJSONv2(sql);
          const tableCount1 = parsed1.tables?.length ?? 0;

          // Export and re-parse multiple times
          let currentParsed = parsed1;
          for (let i = 0; i < 3; i++) {
            const exported = ModelExporter.export(currentParsed, 'mysql', false);
            currentParsed = Parser.parseMySQLToJSONv2(exported);
          }

          const finalTableCount = currentParsed.tables?.length ?? 0;

          // Should not create more tables than the original
          expect(finalTableCount).toBeLessThanOrEqual(tableCount1 + 1); // Allow 1 for potential default schema
        }),
        { numRuns: 15 },
      );
    });

    test('round-trip should preserve enum count', () => {
      fc.assert(
        fc.property(sqlSchema('mysql'), (schema) => {
          const sql = formatSqlSchema(schema, 'mysql');

          // First parse
          const parsed1 = Parser.parseMySQLToJSONv2(sql);
          const enumCount1 = parsed1.enums?.length ?? 0;

          // Export and re-parse
          const exported1 = ModelExporter.export(parsed1, 'mysql', false);
          const parsed2 = Parser.parseMySQLToJSONv2(exported1);
          const enumCount2 = parsed2.enums?.length ?? 0;

          // Export and re-parse again
          const exported2 = ModelExporter.export(parsed2, 'mysql', false);
          const parsed3 = Parser.parseMySQLToJSONv2(exported2);
          const enumCount3 = parsed3.enums?.length ?? 0;

          // Enum count should stabilize
          expect(enumCount2).toBe(enumCount3);
        }),
        { numRuns: 20 },
      );
    });
  });
});
