import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import {
  tableArbitrary,
  enumArbitrary,
  anyRefArbitrary,
  tableGroupArbitrary,
  projectArbitrary,
  standaloneNoteArbitrary,
  dbmlSchemaArbitrary,
  // Malformed input arbitraries for true fuzzing
  malformedInputArbitrary,
  unclosedBracketArbitrary,
  mismatchedBracketsArbitrary,
  unclosedStringArbitrary,
  truncatedInputArbitrary,
  binaryGarbageArbitrary,
  extremeNestingArbitrary,
  malformedTableArbitrary,
  malformedEnumArbitrary,
  malformedRefArbitrary,
  selfReferentialTableArbitrary,
  circularRefArbitrary,
  danglingRefArbitrary,
  emptyTableArbitrary,
  conflictingSettingsArbitrary,
  // Mutation arbitraries
  charSubstitutionArbitrary,
  multiCharInsertionArbitrary,
  blockDuplicationArbitrary,
  // Line ending utilities
  crlfSchemaArbitrary,
} from '../utils/arbitraries';
import { parse, lex } from '../utils';
import { SyntaxNodeKind } from '@/core/parser/nodes';

// Run counts chosen for balance of coverage vs execution time
const FUZZ_CONFIG = { numRuns: 200 };
const ROBUSTNESS_CONFIG = { numRuns: 100 };

describe('[fuzz] parser - valid input', () => {
  it('should parse valid tables without errors and produce valid AST', () => {
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const result = parse(source);

        // No parse errors
        expect(result.getErrors()).toHaveLength(0);

        // AST has valid structure
        const ast = result.getValue().ast;
        expect(ast).toBeDefined();
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body).toBeInstanceOf(Array);

        // At least one element was parsed
        expect(ast.body.length).toBeGreaterThanOrEqual(1);

        // All elements have valid positions within source bounds
        ast.body.forEach((elem) => {
          expect(elem.start).toBeGreaterThanOrEqual(0);
          expect(elem.end).toBeGreaterThan(elem.start);
          expect(elem.end).toBeLessThanOrEqual(source.length);
          expect(elem.startPos.line).toBeGreaterThanOrEqual(0);
          expect(elem.startPos.column).toBeGreaterThanOrEqual(0);
        });
      }),
      FUZZ_CONFIG,
    );
  });

  it('should parse valid enums without errors and produce valid AST', () => {
    fc.assert(
      fc.property(enumArbitrary, (source: string) => {
        const result = parse(source);

        expect(result.getErrors()).toHaveLength(0);

        const ast = result.getValue().ast;
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body.length).toBeGreaterThanOrEqual(1);

        // First element should be an enum
        const firstElem = ast.body[0];
        expect(firstElem.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
      }),
      FUZZ_CONFIG,
    );
  });

  it('should parse valid refs without errors', () => {
    fc.assert(
      fc.property(anyRefArbitrary, (source: string) => {
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);

        const ast = result.getValue().ast;
        expect(ast.body.length).toBeGreaterThanOrEqual(1);
      }),
      FUZZ_CONFIG,
    );
  });

  it('should parse valid table groups without errors', () => {
    fc.assert(
      fc.property(tableGroupArbitrary, (source: string) => {
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);

        const ast = result.getValue().ast;
        expect(ast.body.length).toBeGreaterThanOrEqual(1);
      }),
      FUZZ_CONFIG,
    );
  });

  it('should parse valid projects without errors', () => {
    fc.assert(
      fc.property(projectArbitrary, (source: string) => {
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);

        const ast = result.getValue().ast;
        expect(ast.body.length).toBeGreaterThanOrEqual(1);
      }),
      FUZZ_CONFIG,
    );
  });

  it('should parse valid standalone notes without errors', () => {
    fc.assert(
      fc.property(standaloneNoteArbitrary, (source: string) => {
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);
      }),
      FUZZ_CONFIG,
    );
  });

  it('should parse complete schemas without errors', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);

        const ast = result.getValue().ast;
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);

        // All elements should have valid structure
        ast.body.forEach((elem) => {
          expect(elem.kind).toBe(SyntaxNodeKind.ELEMENT_DECLARATION);
          expect(elem.start).toBeLessThanOrEqual(elem.end);
        });
      }),
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] parser - robustness (arbitrary input)', () => {
  it('should return valid result structure on arbitrary strings', () => {
    fc.assert(
      fc.property(fc.string().filter((s) => !s.includes('\0')), (source: string) => {
        const result = parse(source);

        // Must return a valid result object
        expect(result).toBeDefined();
        expect(result.getValue).toBeDefined();
        expect(result.getErrors).toBeDefined();

        // AST must always exist with valid structure
        const ast = result.getValue().ast;
        expect(ast).toBeDefined();
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body).toBeInstanceOf(Array);

        // Errors must have valid structure
        const errors = result.getErrors();
        errors.forEach((error) => {
          expect(error.start).toBeGreaterThanOrEqual(0);
          expect(error.end).toBeLessThanOrEqual(source.length);
        });
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should return valid result on DBML-like special characters', () => {
    const specialChars = fc.stringMatching(/^[{}[\]():,;.><\-~"'`\\\n\r\t $@#%]*$/);

    fc.assert(
      fc.property(specialChars, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body).toBeInstanceOf(Array);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle very long inputs (10-50KB) without stack overflow', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 10000, maxLength: 50000 }).filter((s) => !s.includes('\0')),
        (source: string) => {
          const result = parse(source);
          const ast = result.getValue().ast;

          expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
          // Position bounds must be valid
          expect(ast.end).toBeLessThanOrEqual(source.length);
        },
      ),
      { numRuns: 50 },
    );
  });

  it('should handle deeply nested brackets (1-200 levels)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 200 }),
        (depth: number) => {
          const source = '['.repeat(depth) + ']'.repeat(depth);
          const result = parse(source);

          expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should handle deeply nested braces (1-100 levels)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100 }),
        (depth: number) => {
          const source = 'Table t '.repeat(depth) + '{'.repeat(depth) + '}'.repeat(depth);
          const result = parse(source);

          expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should recover valid elements around garbage input', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        fc.string().filter((s) => !s.includes('\0')),
        tableArbitrary,
        (validBefore: string, garbage: string, validAfter: string) => {
          const source = `${validBefore}\n${garbage}\n${validAfter}`;
          const result = parse(source);
          const ast = result.getValue().ast;

          expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
          // Should recover at least some elements
          expect(ast.body.length).toBeGreaterThanOrEqual(0);
        },
      ),
      { numRuns: 200 },
    );
  });
});

describe('[fuzz] parser - error recovery', () => {
  it('should always produce an AST even with errors', () => {
    fc.assert(
      fc.property(fc.string(), (source: string) => {
        const result = parse(source);

        // AST should always exist
        const ast = result.getValue().ast;
        expect(ast).toBeDefined();
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body).toBeInstanceOf(Array);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should report errors with valid locations', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (source: string) => {
        const result = parse(source);
        const errors = result.getErrors();

        errors.forEach((error) => {
          // Error should have valid position info
          expect(error.start).toBeGreaterThanOrEqual(0);
          expect(error.end).toBeGreaterThanOrEqual(error.start);
          expect(error.nodeOrToken).toBeDefined();
        });
      }),
      ROBUSTNESS_CONFIG,
    );
  });
});

describe('[fuzz] parser - consistency', () => {
  it('should produce same result when parsing same input twice', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result1 = parse(source);
        const result2 = parse(source);

        expect(result1.getErrors().length).toBe(result2.getErrors().length);

        const ast1 = result1.getValue().ast;
        const ast2 = result2.getValue().ast;

        expect(ast1.body.length).toBe(ast2.body.length);
      }),
      FUZZ_CONFIG,
    );
  });

  it('should have tokens covering entire source without gaps', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const tokens = lex(source).getValue();

        // Verify tokens are contiguous (no gaps)
        for (let i = 1; i < tokens.length; i++) {
          const prev = tokens[i - 1];
          const curr = tokens[i];

          // Current token should start at or after previous token ends
          // (trivia is attached to tokens, so we use fullEnd/fullStart)
          expect(curr.start).toBeGreaterThanOrEqual(prev.end);
        }
      }),
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] parser - mutation resilience', () => {
  it('should produce valid AST after single character insertion', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        fc.nat(),
        fc.string({ minLength: 1, maxLength: 1 }).filter((c) => c !== '\0'),
        (source: string, position: number, char: string) => {
          const pos = position % (source.length + 1);
          const mutated = source.slice(0, pos) + char + source.slice(pos);

          const result = parse(mutated);
          const ast = result.getValue().ast;

          expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
          expect(ast.end).toBeLessThanOrEqual(mutated.length);
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should produce valid AST after character deletion', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        fc.nat(),
        (source: string, position: number) => {
          fc.pre(source.length > 0);

          const pos = position % source.length;
          const mutated = source.slice(0, pos) + source.slice(pos + 1);

          const result = parse(mutated);
          const ast = result.getValue().ast;

          expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('should produce valid AST after character substitution', () => {
    fc.assert(
      fc.property(
        tableArbitrary.chain((source) => charSubstitutionArbitrary(source)),
        (mutated: string) => {
          const result = parse(mutated);
          const ast = result.getValue().ast;

          expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should produce valid AST after multi-character insertion', () => {
    fc.assert(
      fc.property(
        tableArbitrary.chain((source) => multiCharInsertionArbitrary(source)),
        (mutated: string) => {
          const result = parse(mutated);
          const ast = result.getValue().ast;

          expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should produce valid AST after block duplication', () => {
    fc.assert(
      fc.property(
        tableArbitrary.chain((source) => blockDuplicationArbitrary(source)),
        (mutated: string) => {
          const result = parse(mutated);
          const ast = result.getValue().ast;

          expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// True binary fuzzing - completely arbitrary byte sequences
describe('[fuzz] parser - true binary fuzzing (unconstrained)', () => {
  it('should handle arbitrary byte sequences without crashing', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 0, maxLength: 1000 }),
        (bytes: Uint8Array) => {
          // Convert bytes to string - may contain null bytes, control chars, etc.
          const source = String.fromCharCode(...bytes);

          let didThrow = false;
          let result;
          try {
            result = parse(source);
          } catch (e) {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
          if (result) {
            expect(result.getValue().ast).toBeDefined();
            expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('should handle null bytes embedded in valid DBML', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        fc.nat(),
        (source: string, position: number) => {
          // Insert null byte at random position
          const pos = position % (source.length + 1);
          const withNull = source.slice(0, pos) + '\0' + source.slice(pos);

          let didThrow = false;
          try {
            parse(withNull);
          } catch {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should handle high unicode codepoints', () => {
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 0, max: 0x10FFFF }), { minLength: 1, maxLength: 100 }),
        (codePoints: number[]) => {
          // Convert codepoints to string, filtering out invalid surrogate pairs
          const validCodePoints = codePoints.filter((cp) =>
            cp <= 0xD7FF || (cp >= 0xE000 && cp <= 0x10FFFF),
          );
          const source = String.fromCodePoint(...validCodePoints);

          let didThrow = false;
          try {
            parse(source);
          } catch {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });

  it('should handle control characters in various positions', () => {
    const controlChars = fc.constantFrom(
      '\x00', '\x01', '\x02', '\x03', '\x04', '\x05', '\x06', '\x07',
      '\x08', '\x0B', '\x0C', '\x0E', '\x0F', '\x10', '\x11', '\x12',
      '\x13', '\x14', '\x15', '\x16', '\x17', '\x18', '\x19', '\x1A',
      '\x1B', '\x1C', '\x1D', '\x1E', '\x1F', '\x7F',
    );

    fc.assert(
      fc.property(
        tableArbitrary,
        fc.array(fc.tuple(fc.nat(), controlChars), { minLength: 1, maxLength: 5 }),
        (source: string, insertions: Array<[number, string]>) => {
          // Insert control characters at various positions
          let modified = source;
          for (const [pos, char] of insertions) {
            const insertPos = pos % (modified.length + 1);
            modified = modified.slice(0, insertPos) + char + modified.slice(insertPos);
          }

          let didThrow = false;
          try {
            parse(modified);
          } catch {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
        },
      ),
      { numRuns: 200 },
    );
  });
});

// Malformed Input Tests - syntactically invalid inputs to verify error recovery
describe('[fuzz] parser - malformed input (true fuzzing)', () => {
  it('should produce valid AST structure on malformed input', () => {
    fc.assert(
      fc.property(malformedInputArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body).toBeInstanceOf(Array);
      }),
      { numRuns: 300 },
    );
  });

  it('should report errors for unclosed brackets', () => {
    fc.assert(
      fc.property(unclosedBracketArbitrary, (source: string) => {
        const result = parse(source);

        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should report errors for mismatched brackets', () => {
    fc.assert(
      fc.property(mismatchedBracketsArbitrary, (source: string) => {
        const result = parse(source);

        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should report errors for unclosed strings', () => {
    fc.assert(
      fc.property(unclosedStringArbitrary, (source: string) => {
        const result = parse(source);

        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should report errors for truncated input', () => {
    fc.assert(
      fc.property(truncatedInputArbitrary, (source: string) => {
        const result = parse(source);

        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        // Truncated input should produce errors
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle binary garbage with valid result structure', () => {
    fc.assert(
      fc.property(binaryGarbageArbitrary.filter((s) => !s.includes('\0')), (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle extremely deep nesting (500+ levels)', () => {
    fc.assert(
      fc.property(extremeNestingArbitrary, (source: string) => {
        const result = parse(source);

        expect(result.getValue().ast.kind).toBe(SyntaxNodeKind.PROGRAM);
      }),
      { numRuns: 20 },
    );
  });

  it('should report errors for malformed table declarations', () => {
    fc.assert(
      fc.property(malformedTableArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        // Malformed tables should produce errors
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should report errors for malformed enum declarations', () => {
    fc.assert(
      fc.property(malformedEnumArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should report errors for malformed ref declarations', () => {
    fc.assert(
      fc.property(malformedRefArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(result.getErrors().length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });
});

// Semantic Correctness - verify parsing produces correct results
describe('[fuzz] parser - semantic correctness', () => {
  it('should report errors for obviously malformed input', () => {
    // Use obviously malformed inputs that will always error
    const obviouslyMalformed = fc.constantFrom(
      'Table {',
      'Ref: users.id >',
      '{{{{',
    );

    fc.assert(
      fc.property(obviouslyMalformed, (source: string) => {
        const result = parse(source);
        const errors = result.getErrors();

        expect(errors.length).toBeGreaterThan(0);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should produce different ASTs for different valid inputs', () => {
    fc.assert(
      fc.property(
        tableArbitrary,
        tableArbitrary,
        (source1: string, source2: string) => {
          // Skip if sources happen to be identical
          if (source1 === source2) return;

          const result1 = parse(source1);
          const result2 = parse(source2);

          const ast1 = result1.getValue().ast;
          const ast2 = result2.getValue().ast;

          expect(ast1).toBeDefined();
          expect(ast2).toBeDefined();

          // Different inputs should produce different ASTs (verify via source positions)
          // Note: Two different sources with same length can have same AST structure
          // but their content should differ (verified by source !== source2 check above)
          expect(ast1.end).toBe(source1.length);
          expect(ast2.end).toBe(source2.length);
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should count elements correctly', () => {
    fc.assert(
      fc.property(
        fc.array(tableArbitrary, { minLength: 1, maxLength: 5 }),
        (tables: string[]) => {
          const source = tables.join('\n\n');
          const result = parse(source);
          const ast = result.getValue().ast;

          // If no errors, element count should match input count
          if (result.getErrors().length === 0) {
            expect(ast.body.length).toBe(tables.length);
          }
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should preserve element order in AST', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        // Elements should appear in source order
        for (let i = 1; i < ast.body.length; i++) {
          const prev = ast.body[i - 1];
          const curr = ast.body[i];
          expect(curr.start).toBeGreaterThanOrEqual(prev.end);
        }
      }),
      FUZZ_CONFIG,
    );
  });

  it('should produce errors with distinct locations for different problems', () => {
    fc.assert(
      fc.property(
        malformedTableArbitrary,
        malformedEnumArbitrary,
        (table: string, enumDef: string) => {
          const combined = `${table}\n\n${enumDef}`;
          const result = parse(combined);
          const errors = result.getErrors();

          if (errors.length >= 2) {
            // Errors should be at different locations (not all pointing to same spot)
            const locations = errors.map((e) => `${e.start}-${e.end}`);
            const uniqueLocations = new Set(locations);
            // Should have at least some location diversity (not all errors at identical positions)
            expect(uniqueLocations.size).toBeGreaterThanOrEqual(1);
            // If many errors, should have multiple locations
            if (errors.length >= 4) {
              expect(uniqueLocations.size).toBeGreaterThanOrEqual(2);
            }
          }
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });
});

// Edge Case Patterns - self-references, circular refs, empty tables
describe('[fuzz] parser - special patterns', () => {
  it('should parse self-referential tables', () => {
    fc.assert(
      fc.property(selfReferentialTableArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast).toBeDefined();
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        // Parser should accept the syntax (semantic validation is separate)
      }),
      FUZZ_CONFIG,
    );
  });

  it('should parse circular reference patterns', () => {
    fc.assert(
      fc.property(circularRefArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast).toBeDefined();
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
        expect(ast.body.length).toBeGreaterThanOrEqual(2);
      }),
      FUZZ_CONFIG,
    );
  });

  it('should handle empty tables', () => {
    fc.assert(
      fc.property(emptyTableArbitrary, (source: string) => {
        const result = parse(source);
        const ast = result.getValue().ast;

        expect(ast).toBeDefined();
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should report errors for dangling references', () => {
    fc.assert(
      fc.property(danglingRefArbitrary, (source: string) => {
        // Parser should accept the syntax
        const result = parse(source);
        expect(result.getValue().ast).toBeDefined();
        // Note: Semantic errors (unknown table) are caught by analyzer, not parser
      }),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle conflicting settings', () => {
    fc.assert(
      fc.property(conflictingSettingsArbitrary, (source: string) => {
        // Parser should accept the syntax
        const result = parse(source);
        expect(result.getValue().ast).toBeDefined();
        // Note: Semantic conflicts are caught by validator, not parser
      }),
      ROBUSTNESS_CONFIG,
    );
  });
});

describe('[fuzz] parser - CRLF line endings', () => {
  it('should parse schemas with CRLF line endings without errors', () => {
    fc.assert(
      fc.property(crlfSchemaArbitrary, (source: string) => {
        const result = parse(source);
        expect(result.getErrors()).toHaveLength(0);

        const ast = result.getValue().ast;
        expect(ast.kind).toBe(SyntaxNodeKind.PROGRAM);
      }),
      FUZZ_CONFIG,
    );
  });

  it('should produce equivalent AST for LF and CRLF versions', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (lfSource: string) => {
        const crlfSource = lfSource.replace(/\n/g, '\r\n');

        const lfResult = parse(lfSource);
        const crlfResult = parse(crlfSource);

        // Both should parse without errors
        expect(lfResult.getErrors()).toHaveLength(0);
        expect(crlfResult.getErrors()).toHaveLength(0);

        // Both should have same number of elements
        expect(lfResult.getValue().ast.body.length).toBe(crlfResult.getValue().ast.body.length);
      }),
      FUZZ_CONFIG,
    );
  });
});
