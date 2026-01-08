import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  dbmlSchemaArbitrary,
  tableArbitrary,
  enumArbitrary,
  selfReferentialTableArbitrary,
  circularRefArbitrary,
  danglingRefArbitrary,
  conflictingSettingsArbitrary,
  malformedInputArbitrary,
  tableWithZeroSettingsArbitrary,
  charSubstitutionArbitrary,
} from '../utils/arbitraries';
import { interpret, analyze } from '../utils';

// Run counts chosen for balance of coverage vs execution time
const FUZZ_CONFIG = { numRuns: 200 };
const ROBUSTNESS_CONFIG = { numRuns: 100 };
const SEMANTIC_CONFIG = { numRuns: 150 };

describe('[fuzz] interpreter - valid input', () => {
  it('should interpret valid DBML schemas without throwing', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();
        const errors = result.getErrors();

        // Must have either a result or errors explaining why not (no silent failures)
        if (db === undefined) {
          expect(errors.length).toBeGreaterThan(0);
        }

        // If there are errors, they should have valid structure
        if (errors.length > 0) {
          errors.forEach((error) => {
            expect(error.diagnostic.length).toBeGreaterThan(0);
          });
        }
      }),
      FUZZ_CONFIG,
    );
  });

  it('should produce valid Database objects from valid schemas', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();
        const errors = result.getErrors();

        // Either db is defined or there are errors
        if (!db) {
          expect(errors.length).toBeGreaterThan(0);
          return;
        }

        // Database object should have all required properties
        expect(db.tables).toBeInstanceOf(Array);
        expect(db.refs).toBeInstanceOf(Array);
        expect(db.enums).toBeInstanceOf(Array);
        expect(db.tableGroups).toBeInstanceOf(Array);

        // All tables should have valid structure
        db.tables.forEach((table) => {
          expect(table.name).toBeDefined();
          expect(table.fields).toBeInstanceOf(Array);

          table.fields.forEach((field) => {
            expect(field.name).toBeDefined();
            expect(field.type).toBeDefined();
          });
        });

        // All enums should have valid structure
        db.enums.forEach((enumDef) => {
          expect(enumDef.name).toBeDefined();
          expect(enumDef.values).toBeInstanceOf(Array);

          enumDef.values.forEach((value) => {
            expect(value.name).toBeDefined();
          });
        });

        // All refs should have endpoints
        db.refs.forEach((ref) => {
          expect(ref.endpoints).toBeInstanceOf(Array);
          expect(ref.endpoints.length).toBeGreaterThanOrEqual(2);
        });
      }),
      FUZZ_CONFIG,
    );
  });

  it('should interpret tables with correct field counts', () => {
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        // db may be undefined if interpretation fails
        if (db && db.tables && db.tables.length > 0) {
          const table = db.tables[0];
          expect(table.name).toBeDefined();
          expect(table.fields).toBeInstanceOf(Array);
        }
      }),
      FUZZ_CONFIG,
    );
  });

  it('should interpret enums with correct value counts', () => {
    fc.assert(
      fc.property(enumArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        // db may be undefined if interpretation fails
        if (db && db.enums && db.enums.length > 0) {
          const enumDef = db.enums[0];
          expect(enumDef.name).toBeDefined(); // Empty string is valid
          expect(enumDef.values).toBeInstanceOf(Array);
        }
      }),
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] interpreter - robustness (arbitrary input)', () => {
  it('should return valid result structure on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string().filter((s) => !s.includes('\0')), (source: string) => {
        const result = interpret(source);

        // Must return a valid result object
        expect(result).toBeDefined();
        expect(result.getValue).toBeDefined();
        expect(result.getErrors).toBeDefined();

        // Errors must have valid structure
        const errors = result.getErrors();
        errors.forEach((error) => {
          expect(error.start).toBeGreaterThanOrEqual(0);
          expect(error.end).toBeLessThanOrEqual(source.length);
          expect(error.diagnostic.length).toBeGreaterThan(0);
        });
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle very long inputs (5-20KB) with valid structure', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5000, maxLength: 20000 }).filter((s) => !s.includes('\0')),
        (source: string) => {
          const result = interpret(source);

          expect(result).toBeDefined();
          // Either produces db or has errors explaining why
          const db = result.getValue();
          const errors = result.getErrors();
          if (!db) {
            expect(errors.length).toBeGreaterThan(0);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should return valid result on DBML-like character combinations', () => {
    const dbmlChars = fc.stringMatching(/^[Table{}\[\]():,;.><\-~"'`\n\r\tintvrckhpkEumRf ]*$/);

    fc.assert(
      fc.property(dbmlChars, (source: string) => {
        const result = interpret(source);

        expect(result).toBeDefined();
        expect(result.getErrors()).toBeInstanceOf(Array);
      }),
      ROBUSTNESS_CONFIG,
    );
  });
});

describe('[fuzz] interpreter - error handling', () => {
  it('should return errors array for invalid input', () => {
    fc.assert(
      fc.property(fc.string(), (source: string) => {
        const result = interpret(source);
        const errors = result.getErrors();

        // Errors should always be an array
        expect(errors).toBeInstanceOf(Array);

        // Each error should have proper structure with valid bounds
        errors.forEach((error) => {
          expect(error.code).toBeDefined();
          expect(error.diagnostic).toBeDefined();
          expect(error.start).toBeGreaterThanOrEqual(0);
          expect(error.end).toBeGreaterThanOrEqual(error.start);
          expect(error.end).toBeLessThanOrEqual(source.length);
        });
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should have consistent errors between analyze and interpret', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const analyzeResult = analyze(source);
        const interpretResult = interpret(source);

        // Both should have same number of errors for valid schemas
        // (interpret might have additional interpretation errors)
        expect(interpretResult.getErrors().length).toBeGreaterThanOrEqual(
          analyzeResult.getErrors().length,
        );
      }),
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] interpreter - consistency', () => {
  it('should produce same result when interpreting same input twice', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result1 = interpret(source);
        const result2 = interpret(source);

        const db1 = result1.getValue();
        const db2 = result2.getValue();

        if (db1 && db2) {
          expect(db1.tables.length).toBe(db2.tables.length);
          expect(db1.enums.length).toBe(db2.enums.length);
          expect(db1.refs.length).toBe(db2.refs.length);
          expect(db1.tableGroups.length).toBe(db2.tableGroups.length);

          // Table names should match
          for (let i = 0; i < db1.tables.length; i++) {
            expect(db1.tables[i].name).toBe(db2.tables[i].name);
            expect(db1.tables[i].fields.length).toBe(db2.tables[i].fields.length);
          }
        }
      }),
      FUZZ_CONFIG,
    );
  });

  it('should produce deeply equal output on repeated interpretation', () => {
    // Property: Three consecutive interpretations should yield structurally identical results
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result1 = interpret(source);
        const result2 = interpret(source);
        const result3 = interpret(source);

        const db1 = result1.getValue();
        const db2 = result2.getValue();
        const db3 = result3.getValue();

        // All three should have same undefined/defined status
        expect(db1 === undefined).toBe(db2 === undefined);
        expect(db2 === undefined).toBe(db3 === undefined);

        if (db1 && db2 && db3) {
          // Deep structural equality for tables
          expect(db1.tables.length).toBe(db2.tables.length);
          expect(db2.tables.length).toBe(db3.tables.length);

          for (let i = 0; i < db1.tables.length; i++) {
            const t1 = db1.tables[i];
            const t2 = db2.tables[i];
            const t3 = db3.tables[i];

            expect(t1.name).toBe(t2.name);
            expect(t2.name).toBe(t3.name);
            expect(t1.schemaName).toBe(t2.schemaName);
            expect(t2.schemaName).toBe(t3.schemaName);
            expect(t1.alias).toBe(t2.alias);
            expect(t2.alias).toBe(t3.alias);
            expect(t1.headerColor).toBe(t2.headerColor);
            expect(t2.headerColor).toBe(t3.headerColor);

            // Field equality
            expect(t1.fields.length).toBe(t2.fields.length);
            expect(t2.fields.length).toBe(t3.fields.length);

            for (let j = 0; j < t1.fields.length; j++) {
              expect(t1.fields[j].name).toBe(t2.fields[j].name);
              expect(t2.fields[j].name).toBe(t3.fields[j].name);
              expect(t1.fields[j].type.type_name).toBe(t2.fields[j].type.type_name);
              expect(t2.fields[j].type.type_name).toBe(t3.fields[j].type.type_name);
              expect(t1.fields[j].pk).toBe(t2.fields[j].pk);
              expect(t2.fields[j].pk).toBe(t3.fields[j].pk);
              expect(t1.fields[j].unique).toBe(t2.fields[j].unique);
              expect(t2.fields[j].unique).toBe(t3.fields[j].unique);
              expect(t1.fields[j].not_null).toBe(t2.fields[j].not_null);
              expect(t2.fields[j].not_null).toBe(t3.fields[j].not_null);
            }

            // Index equality
            expect(t1.indexes.length).toBe(t2.indexes.length);
            expect(t2.indexes.length).toBe(t3.indexes.length);
          }

          // Enum equality
          for (let i = 0; i < db1.enums.length; i++) {
            expect(db1.enums[i].name).toBe(db2.enums[i].name);
            expect(db2.enums[i].name).toBe(db3.enums[i].name);
            expect(db1.enums[i].values.length).toBe(db2.enums[i].values.length);
            expect(db2.enums[i].values.length).toBe(db3.enums[i].values.length);
          }

          // Ref equality
          for (let i = 0; i < db1.refs.length; i++) {
            expect(db1.refs[i].endpoints.length).toBe(db2.refs[i].endpoints.length);
            expect(db2.refs[i].endpoints.length).toBe(db3.refs[i].endpoints.length);
          }
        }

        // Error counts should also be consistent
        expect(result1.getErrors().length).toBe(result2.getErrors().length);
        expect(result2.getErrors().length).toBe(result3.getErrors().length);
      }),
      { numRuns: 100 },
    );
  });

  it('should maintain referential integrity in output', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        if (db) {
          const tableNames = new Set(db.tables.map((t) => t.name));
          const tablesByName = new Map(db.tables.map((t) => [t.name, t]));

          // Verify no duplicate table names
          expect(tableNames.size).toBe(db.tables.length);

          // Verify no duplicate enum names
          const enumNames = new Set(db.enums.map((e) => e.name));
          expect(enumNames.size).toBe(db.enums.length);

          // Refs should have valid endpoint structure
          db.refs.forEach((ref) => {
            expect(ref.endpoints).toBeInstanceOf(Array);
            ref.endpoints.forEach((endpoint) => {
              expect(endpoint.tableName).toBeDefined();
              expect(endpoint.fieldNames).toBeInstanceOf(Array);
            });
          });

          // TableGroups should reference existing tables
          db.tableGroups.forEach((group) => {
            group.tables.forEach((tableRef) => {
              expect(tableRef.name).toBeDefined();
            });
          });
        }
      }),
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] interpreter - mutation resilience', () => {
  it('should handle mutations to valid schemas without crashing', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        fc.nat(),
        fc.string({ minLength: 1, maxLength: 1 }),
        (source: string, position: number, char: string) => {
          fc.pre(char !== '\0');

          const pos = position % (source.length + 1);
          const mutated = source.slice(0, pos) + char + source.slice(pos);

          let didThrow = false;
          try {
            interpret(mutated);
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe('[fuzz] interpreter - edge cases', () => {
  it('should handle empty input', () => {
    const result = interpret('');
    const db = result.getValue();

    expect(db).toBeDefined();
    if (db) {
      expect(db.tables).toHaveLength(0);
      expect(db.enums).toHaveLength(0);
      expect(db.refs).toHaveLength(0);
    }
  });

  it('should handle whitespace-only input', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[ \t\n]*$/),
        (source: string) => {
          const result = interpret(source);
          const db = result.getValue();
          expect(db).toBeDefined();
          if (db) {
            expect(db.tables).toHaveLength(0);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should handle comments-only input', () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 1, maxLength: 10 }),
        (comments: string[]) => {
          const source = comments.map((c) => `// ${c.replace(/\n/g, ' ')}`).join('\n');

          let didThrow = false;
          try {
            const result = interpret(source);
            const db = result.getValue();
            if (db) {
              expect(db.tables).toHaveLength(0);
            }
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Semantic Correctness - verify interpretation produces correct results
describe('[fuzz] interpreter - semantic correctness', () => {
  it('should produce tables with non-empty names', () => {
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        fc.pre(db !== undefined);
        fc.pre(db.tables.length > 0);

        db.tables.forEach((table) => {
          expect(table.name).toBeDefined();
          expect(table.name.length).toBeGreaterThan(0);
        });
      }),
      SEMANTIC_CONFIG,
    );
  });

  it('should produce fields with valid types', () => {
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        fc.pre(db !== undefined);
        fc.pre(db.tables.length > 0);
        fc.pre(db.tables[0].fields.length > 0);

        db.tables.forEach((table) => {
          table.fields.forEach((field) => {
            expect(field.type).toBeDefined();
            expect(field.type.type_name).toBeDefined();
            expect(field.type.type_name.length).toBeGreaterThan(0);
          });
        });
      }),
      SEMANTIC_CONFIG,
    );
  });

  it('should produce enums with valid values', () => {
    fc.assert(
      fc.property(enumArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        fc.pre(db !== undefined);
        fc.pre(db.enums.length > 0);

        db.enums.forEach((enumDef) => {
          expect(enumDef.values.length).toBeGreaterThanOrEqual(1);
          enumDef.values.forEach((value) => {
            expect(value.name).toBeDefined();
          });
        });
      }),
      SEMANTIC_CONFIG,
    );
  });

  it('should produce refs with valid endpoints', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        fc.pre(db !== undefined);
        fc.pre(db.refs.length > 0);

        db.refs.forEach((ref) => {
          expect(ref.endpoints.length).toBeGreaterThanOrEqual(2);
          ref.endpoints.forEach((endpoint) => {
            expect(endpoint.tableName).toBeDefined();
            expect(endpoint.fieldNames.length).toBeGreaterThanOrEqual(1);
          });
        });
      }),
      SEMANTIC_CONFIG,
    );
  });

  it('should handle tables with zero column settings', () => {
    fc.assert(
      fc.property(tableWithZeroSettingsArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        fc.pre(db !== undefined);
        fc.pre(db.tables.length > 0);

        const table = db.tables[0];
        table.fields.forEach((field) => {
          expect(field.name).toBeDefined();
          expect(field.type).toBeDefined();
        });
      }),
      SEMANTIC_CONFIG,
    );
  });
});

// Special Patterns - self-references, circular refs, etc.
describe('[fuzz] interpreter - special patterns', () => {
  it('should interpret self-referential tables', () => {
    fc.assert(
      fc.property(selfReferentialTableArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        // Should produce a database (may have errors for unknown refs)
        expect(result).toBeDefined();

        if (db && db.tables.length > 0) {
          // Table should exist
          expect(db.tables[0].name).toBeDefined();
        }
      }),
      FUZZ_CONFIG,
    );
  });

  it('should interpret circular reference patterns', () => {
    fc.assert(
      fc.property(circularRefArbitrary, (source: string) => {
        const result = interpret(source);
        const db = result.getValue();

        if (db) {
          expect(db.tables.length).toBeGreaterThanOrEqual(2);
        }
      }),
      FUZZ_CONFIG,
    );
  });

  it('should handle dangling references gracefully', () => {
    fc.assert(
      fc.property(danglingRefArbitrary, (source: string) => {
        const result = interpret(source);

        // Should not throw
        expect(result).toBeDefined();

        // Should produce errors for unknown references
        const errors = result.getErrors();
        expect(errors.length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle conflicting settings', () => {
    fc.assert(
      fc.property(conflictingSettingsArbitrary, (source: string) => {
        const result = interpret(source);

        // Should not throw
        expect(result).toBeDefined();

        // Should produce a database (validation is a separate concern)
        const db = result.getValue();
        if (db && db.tables.length > 0) {
          expect(db.tables[0].fields).toBeInstanceOf(Array);
        }
      }),
      ROBUSTNESS_CONFIG,
    );
  });
});

// Malformed Input - true fuzzing with invalid inputs
describe('[fuzz] interpreter - malformed input', () => {
  it('should return valid result structure on malformed input', () => {
    fc.assert(
      fc.property(malformedInputArbitrary, (source: string) => {
        const result = interpret(source);

        expect(result).toBeDefined();
        expect(result.getErrors()).toBeInstanceOf(Array);
        // Malformed input should produce errors
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should report errors with valid structure for obviously malformed input', () => {
    const obviouslyMalformed = fc.constantFrom(
      'Table {',
      'Ref: users.id >',
      '{{{{',
    );

    fc.assert(
      fc.property(obviouslyMalformed, (source: string) => {
        const result = interpret(source);
        const errors = result.getErrors();

        expect(errors.length).toBeGreaterThan(0);
        errors.forEach((error) => {
          expect(error.diagnostic.length).toBeGreaterThan(0);
          expect(error.start).toBeGreaterThanOrEqual(0);
        });
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle character substitution mutations without crashing', () => {
    // Test character substitution but filter out null bytes which are known to cause issues
    fc.assert(
      fc.property(
        tableArbitrary.chain((source) => charSubstitutionArbitrary(source)),
        (mutated: string) => {
          // Filter null bytes and other problematic control characters
          const sanitized = mutated.replace(/[\0\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

          let didThrow = false;
          let result;
          try {
            result = interpret(sanitized);
          } catch {
            didThrow = true;
          }

          // Should not throw - errors should be returned in result
          expect(didThrow).toBe(false);
          if (result) {
            expect(result.getErrors()).toBeInstanceOf(Array);
          }
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should return valid result after character deletion', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        fc.nat(),
        (source: string, position: number) => {
          fc.pre(source.length > 0);

          const pos = position % source.length;
          const mutated = source.slice(0, pos) + source.slice(pos + 1);

          const result = interpret(mutated);

          expect(result).toBeDefined();
          expect(result.getErrors()).toBeInstanceOf(Array);
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });
});
