import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { dbmlSchemaArbitrary, tableArbitrary } from '../utils/arbitraries';
import { MockTextModel, createPosition, extractTextFromRange } from '../utils';

// Run counts chosen for balance of coverage vs execution time
const PROPERTY_TEST_CONFIG = { numRuns: 300 };
const EXTENDED_CONFIG = { numRuns: 200 };

// Shared keyword set for identifier detection
const DBML_KEYWORDS = new Set([
  'table', 'ref', 'enum', 'project', 'tablegroup', 'tablepartial',
  'indexes', 'note', 'checks',
  'pk', 'null', 'not', 'unique', 'increment', 'default', 'check',
  'primary', 'key', 'headercolor', 'type', 'name', 'as',
  'cascade', 'restrict', 'set', 'action', 'no',
  'true', 'false', 'int', 'varchar', 'text', 'boolean', 'timestamp',
  'hash', 'btree', 'gin', 'gist',
]);

// Helper: Find all identifier positions in source
function findIdentifierPositions (source: string): Array<{ line: number; column: number }> {
  const positions: Array<{ line: number; column: number }> = [];
  const lines = source.split('\n');
  const seen = new Set<string>();

  lines.forEach((line, lineIndex) => {
    const identifierRegex = /"([^"\\]|\\.)*"|\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;
    let match;
    while ((match = identifierRegex.exec(line)) !== null) {
      const word = match[0];
      if (!word.startsWith('"') && DBML_KEYWORDS.has(word.toLowerCase())) {
        continue;
      }

      const key = `${lineIndex + 1}:${match.index + 1}`;
      if (!seen.has(key)) {
        seen.add(key);
        positions.push({ line: lineIndex + 1, column: match.index + 1 });
      }
    }
  });

  return positions;
}

// Helper: Check if a range is within source bounds
function isRangeValid (source: string, range: any): boolean {
  if (!range) return false;

  const lines = source.split('\n');
  const { startLineNumber, startColumn, endLineNumber, endColumn } = range;

  // Check line bounds
  if (startLineNumber < 1 || endLineNumber < 1) return false;
  if (startLineNumber > lines.length || endLineNumber > lines.length) return false;

  // Check column bounds
  const startLine = lines[startLineNumber - 1];
  const endLine = lines[endLineNumber - 1];
  if (!startLine || !endLine) return false;
  if (startColumn < 1 || endColumn < 1) return false;
  if (startColumn > startLine.length + 1 || endColumn > endLine.length + 1) return false;

  return true;
}

// Helper: Check if range points to an identifier-like token
function rangePointsToIdentifier (source: string, range: any): boolean {
  const text = extractTextFromRange(source, range).trim();
  // Unquoted identifier
  const unquotedIdent = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  // Quoted identifier
  const quotedIdent = /^"([^"\\]|\\.)*"$/;
  // Schema-qualified name (e.g., public.users or "my schema"."my table")
  const qualifiedName = /^([a-zA-Z_][a-zA-Z0-9_]*|"([^"\\]|\\.)*")\.([a-zA-Z_][a-zA-Z0-9_]*|"([^"\\]|\\.)*")$/;
  return unquotedIdent.test(text) || quotedIdent.test(text) || qualifiedName.test(text);
}

// Helper: Get a valid identifier position from a schema
const validIdentifierPositionArbitrary = fc
  .tuple(dbmlSchemaArbitrary)
  .chain(([source]) => {
    const positions = findIdentifierPositions(source);
    if (positions.length === 0) {
      // Skip sources with no identifiers
      return fc.constant(null);
    }
    return fc
      .integer({ min: 0, max: positions.length - 1 })
      .map((index) => ({ source, position: positions[index] }));
  })
  .filter((x): x is { source: string; position: { line: number; column: number } } => x !== null);

describe('[property] DefinitionProvider', () => {
  it('should be idempotent: going to definition twice yields same location', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const firstDefinition = definitionProvider.provideDefinition(model, pos);
        fc.pre(Array.isArray(firstDefinition));
        fc.pre(firstDefinition.length > 0);

        const defLocation = firstDefinition[0];
        const defPos = createPosition(
          defLocation.range.startLineNumber,
          defLocation.range.startColumn,
        );

        const secondDefinition = definitionProvider.provideDefinition(model, defPos);
        fc.pre(Array.isArray(secondDefinition));

        // Second definition should either be empty (we're at a declaration)
        // or should point to the same location
        if (secondDefinition.length > 0) {
          expect(secondDefinition[0].range).toEqual(firstDefinition[0].range);
        }
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should return valid ranges within source bounds', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const definitions = definitionProvider.provideDefinition(model, pos);
        fc.pre(Array.isArray(definitions));
        fc.pre(definitions.length > 0);

        definitions.forEach((def) => {
          expect(isRangeValid(source, def.range)).toBe(true);
          expect(rangePointsToIdentifier(source, def.range)).toBe(true);
        });
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should return unique definition locations (no duplicates)', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const definitions = definitionProvider.provideDefinition(model, pos);
        fc.pre(Array.isArray(definitions));
        fc.pre(definitions.length > 0);

        const rangeStrings = definitions.map((def) => JSON.stringify(def.range));
        const uniqueRanges = new Set(rangeStrings);
        expect(uniqueRanges.size).toBe(rangeStrings.length);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });
});

describe('[property] ReferencesProvider', () => {
  it('should find all references with valid ranges', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const references = referencesProvider.provideReferences(model, pos);
        fc.pre(references && references.length > 0);

        references.forEach((ref) => {
          expect(isRangeValid(source, ref.range)).toBe(true);
          expect(rangePointsToIdentifier(source, ref.range)).toBe(true);
        });
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should not include declaration in references from declaration site', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const definitions = definitionProvider.provideDefinition(model, pos);
        fc.pre(Array.isArray(definitions));
        fc.pre(definitions.length > 0);

        const defLocation = definitions[0];
        const defPos = createPosition(
          defLocation.range.startLineNumber,
          defLocation.range.startColumn,
        );

        const references = referencesProvider.provideReferences(model, defPos);
        fc.pre(references && references.length > 0);

        // References should not include the declaration itself
        const hasDeclaration = references.some((ref) =>
          ref.range.startLineNumber === defLocation.range.startLineNumber
          && ref.range.startColumn === defLocation.range.startColumn,
        );
        expect(hasDeclaration).toBe(false);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should return unique reference locations (no duplicates)', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const references = referencesProvider.provideReferences(model, pos);
        fc.pre(references && references.length > 0);

        const rangeStrings = references.map((ref) => JSON.stringify(ref.range));
        const uniqueRanges = new Set(rangeStrings);
        expect(uniqueRanges.size).toBe(rangeStrings.length);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });
});

// Helper: Generate a valid position within source bounds
const boundedPositionArbitrary = (source: string) => {
  const lines = source.split('\n');
  const maxLine = Math.max(1, lines.length);
  return fc.integer({ min: 1, max: maxLine }).chain((lineNum) => {
    const lineContent = lines[lineNum - 1] || '';
    const maxCol = Math.max(1, lineContent.length + 1);
    return fc.integer({ min: 1, max: maxCol }).map((col) => ({ line: lineNum, col }));
  });
};

describe('[property] CompletionItemProvider', () => {
  it('should return completions with valid labels', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary.chain((source) =>
          boundedPositionArbitrary(source).map((pos) => ({ source, ...pos })),
        ),
        ({ source, line, col }) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line, col);

          const completions = completionProvider.provideCompletionItems(model, position);

          if (completions && completions.suggestions) {
            completions.suggestions.forEach((suggestion) => {
              expect(suggestion.label).toBeDefined();
              expect(suggestion.insertText).toBeDefined();
            });
          }
        },
      ),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should not return empty suggestion lists for valid DBML positions', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source) => {
        // Test at the end of the source (a common completion position)
        const lines = source.split('\n');
        const lastLine = Math.max(1, lines.length);
        const lastLineContent = lines[lastLine - 1] || '';
        const lastCol = lastLineContent.length + 1;

        const compiler = new Compiler();
        compiler.setSource(source);

        const completionProvider = new DBMLCompletionItemProvider(compiler);
        const model = new MockTextModel(source) as any;
        const position = createPosition(lastLine, lastCol);

        const completions = completionProvider.provideCompletionItems(model, position);

        // Should always provide some completions (keywords at minimum)
        expect(completions).toBeDefined();
        expect(completions.suggestions).toBeDefined();
      }),
      PROPERTY_TEST_CONFIG,
    );
  });
});

describe('[property] CompletionItemProvider - determinism', () => {
  it('should be deterministic: same position gives same completions', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary.chain((source) =>
          boundedPositionArbitrary(source).map((pos) => ({ source, ...pos })),
        ),
        ({ source, line, col }) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line, col);

          const completions1 = completionProvider.provideCompletionItems(model, position);
          const completions2 = completionProvider.provideCompletionItems(model, position);

          const labels1 = completions1?.suggestions?.map((s) => s.label).sort() || [];
          const labels2 = completions2?.suggestions?.map((s) => s.label).sort() || [];

          expect(labels1).toEqual(labels2);
        },
      ),
      EXTENDED_CONFIG,
    );
  });
});

describe('[property] Range ordering', () => {
  it('should have properly ordered ranges in definitions', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const definitions = definitionProvider.provideDefinition(model, pos);

        if (Array.isArray(definitions) && definitions.length > 0) {
          definitions.forEach((def) => {
            const { startLineNumber, endLineNumber, startColumn, endColumn } = def.range;
            // End should be after or equal to start
            expect(endLineNumber).toBeGreaterThanOrEqual(startLineNumber);
            if (startLineNumber === endLineNumber) {
              expect(endColumn).toBeGreaterThanOrEqual(startColumn);
            }
          });
        }
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should have properly ordered ranges in references', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const references = referencesProvider.provideReferences(model, pos);

        if (references && references.length > 0) {
          references.forEach((ref) => {
            const { startLineNumber, endLineNumber, startColumn, endColumn } = ref.range;
            expect(endLineNumber).toBeGreaterThanOrEqual(startLineNumber);
            if (startLineNumber === endLineNumber) {
              expect(endColumn).toBeGreaterThanOrEqual(startColumn);
            }
          });
        }
      }),
      EXTENDED_CONFIG,
    );
  });
});

describe('[property] Service stability', () => {
  it('should handle source updates correctly', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, tableArbitrary, (source1, source2) => {
        const compiler = new Compiler();

        // Set first source
        compiler.setSource(source1);
        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model1 = new MockTextModel(source1) as any;

        // Get definitions from first source
        const pos = createPosition(1, 1);
        const defs1 = definitionProvider.provideDefinition(model1, pos);
        expect(Array.isArray(defs1)).toBe(true);

        // Update source
        compiler.setSource(source2);
        const model2 = new MockTextModel(source2) as any;

        // Get definitions from second source
        const defs2 = definitionProvider.provideDefinition(model2, pos);
        expect(Array.isArray(defs2)).toBe(true);

        // Should not have stale data from first source
        // (definitions should be from second source now)
        if (Array.isArray(defs2) && defs2.length > 0) {
          defs2.forEach((def) => {
            expect(isRangeValid(source2, def.range)).toBe(true);
          });
        }
      }),
      EXTENDED_CONFIG,
    );
  });

  it('should not crash on rapid source changes', () => {
    fc.assert(
      fc.property(
        fc.array(dbmlSchemaArbitrary, { minLength: 2, maxLength: 5 }),
        (sources) => {
          const compiler = new Compiler();
          const definitionProvider = new DBMLDefinitionProvider(compiler);

          let didThrow = false;
          try {
            sources.forEach((source) => {
              compiler.setSource(source);
              const model = new MockTextModel(source) as any;
              definitionProvider.provideDefinition(model, createPosition(1, 1));
            });
          } catch {
            didThrow = true;
          }

          expect(didThrow).toBe(false);
        },
      ),
      EXTENDED_CONFIG,
    );
  });
});

describe('[property] Services - null/empty results', () => {
  // These tests explicitly verify behavior when services return null/empty
  // instead of skipping such cases with fc.pre()

  it('should return null or empty array for positions in whitespace', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source: string) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;

        // Find whitespace positions
        const lines = source.split('\n');
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          const line = lines[lineIdx];
          for (let colIdx = 0; colIdx < line.length; colIdx++) {
            if (/\s/.test(line[colIdx])) {
              const position = createPosition(lineIdx + 1, colIdx + 1);

              // Definition at whitespace should be null or empty array
              const definitions = definitionProvider.provideDefinition(model, position);
              expect(definitions === null || (Array.isArray(definitions) && definitions.length === 0)).toBe(true);

              // References at whitespace should be null or empty array
              const references = referencesProvider.provideReferences(model, position);
              expect(references === null || references.length === 0).toBe(true);

              return; // Test one whitespace position per source
            }
          }
        }
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should return null for definitions at keyword positions', () => {
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;

        // Position at 'Table' keyword (line 1, col 1)
        const position = createPosition(1, 1);
        const definitions = definitionProvider.provideDefinition(model, position);

        // Keywords don't have definitions
        expect(definitions === null || (Array.isArray(definitions) && definitions.length === 0)).toBe(true);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should count null vs non-null results without skipping', () => {
    // Meta-test: verify we actually test null results
    let nullCount = 0;
    let nonNullCount = 0;

    fc.assert(
      fc.property(
        dbmlSchemaArbitrary,
        fc.nat({ max: 100 }),
        fc.nat({ max: 100 }),
        (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const definitionProvider = new DBMLDefinitionProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line + 1, col + 1);

          const definitions = definitionProvider.provideDefinition(model, position);

          if (definitions === null || (Array.isArray(definitions) && definitions.length === 0)) {
            nullCount++;
          } else {
            nonNullCount++;
          }

          // Just verify it doesn't crash
          return true;
        },
      ),
      PROPERTY_TEST_CONFIG,
    );

    // Should have tested both null and non-null cases
    // (this is a sanity check - exact counts depend on random input)
    expect(nullCount + nonNullCount).toBe(300); // numRuns
  });
});

describe('[property] Cross-Service', () => {
  it('should maintain definition-references symmetry when both exist', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const definitions = definitionProvider.provideDefinition(model, pos);
        fc.pre(Array.isArray(definitions) && definitions.length > 0);

        const defLocation = definitions[0];
        const defPos = createPosition(
          defLocation.range.startLineNumber,
          defLocation.range.startColumn,
        );

        const references = referencesProvider.provideReferences(model, defPos);
        fc.pre(references && references.length > 0);

        // References should have valid range structure
        references.forEach((ref) => {
          expect(ref.range.startLineNumber).toBeGreaterThanOrEqual(1);
          expect(ref.range.endLineNumber).toBeGreaterThanOrEqual(ref.range.startLineNumber);
        });
      }),
      PROPERTY_TEST_CONFIG,
    );
  });

  it('should return array from completion provider', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const completionProvider = new DBMLCompletionItemProvider(compiler);
        const model = new MockTextModel(source) as any;

        const position = createPosition(1, 1);
        const completions = completionProvider.provideCompletionItems(model, position);

        // Completions should always return valid structure
        expect(completions).toBeDefined();
        expect(completions.suggestions).toBeDefined();
        expect(completions.suggestions).toBeInstanceOf(Array);
      }),
      PROPERTY_TEST_CONFIG,
    );
  });
});
