import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { dbmlSchemaArbitrary, tableArbitrary } from '../utils/arbitraries';
import { MockTextModel, createPosition } from '../utils';

const FUZZ_CONFIG = { numRuns: 50 };
const ROBUSTNESS_CONFIG = { numRuns: 25 };

// Helper to create valid position within source bounds
function clampPosition (line: number, col: number, source: string): { line: number; col: number } {
  const lines = source.split('\n');
  const maxLine = Math.max(0, lines.length - 1);
  const clampedLine = Math.min(Math.max(0, line), maxLine);
  const maxCol = lines[clampedLine]?.length || 0;
  const clampedCol = Math.min(Math.max(0, col), maxCol);
  return { line: clampedLine, col: clampedCol };
}

describe('[fuzz] DefinitionProvider - robustness', () => {
  it('should handle any position without crashing in arbitrary source', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        fc.nat(),
        (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const definitionProvider = new DBMLDefinitionProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line + 1, col + 1);

          let didThrow = false;
          try {
            definitionProvider.provideDefinition(model, position);
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle any position without crashing in valid DBML schemas', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary,
        fc.nat(),
        fc.nat(),
        (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const definitionProvider = new DBMLDefinitionProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line + 1, col + 1);

          let didThrow = false;
          try {
            definitionProvider.provideDefinition(model, position);
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should return valid result structure when definitions are found', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, fc.nat(), fc.nat(), (source: string, line: number, col: number) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;

        // Use clamped position to increase chance of valid results
        const { line: clampedLine, col: clampedCol } = clampPosition(line, col, source);
        const position = createPosition(clampedLine + 1, clampedCol + 1);

        const result = definitionProvider.provideDefinition(model, position);

        // Result should be null or have valid structure
        if (result) {
          if (Array.isArray(result)) {
            result.forEach((def) => {
              expect(def.range).toBeDefined();
              expect(def.range.startLineNumber).toBeGreaterThanOrEqual(1);
              expect(def.range.startColumn).toBeGreaterThanOrEqual(1);
            });
          } else {
            expect(result.range).toBeDefined();
          }
        }
      }),
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] ReferencesProvider - robustness', () => {
  it('should handle any position without crashing in arbitrary source', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        fc.nat(),
        (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const referencesProvider = new DBMLReferencesProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line + 1, col + 1);

          let didThrow = false;
          try {
            referencesProvider.provideReferences(model, position);
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle any position without crashing in valid DBML schemas', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary,
        fc.nat(),
        fc.nat(),
        (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const referencesProvider = new DBMLReferencesProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line + 1, col + 1);

          let didThrow = false;
          try {
            referencesProvider.provideReferences(model, position);
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should return valid result structure when references are found', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, fc.nat(), fc.nat(), (source: string, line: number, col: number) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;

        const { line: clampedLine, col: clampedCol } = clampPosition(line, col, source);
        const position = createPosition(clampedLine + 1, clampedCol + 1);

        const result = referencesProvider.provideReferences(model, position);

        // Result should be null or valid array
        if (result) {
          expect(result).toBeInstanceOf(Array);
          result.forEach((ref) => {
            expect(ref.range).toBeDefined();
            expect(ref.range.startLineNumber).toBeGreaterThanOrEqual(1);
            expect(ref.range.startColumn).toBeGreaterThanOrEqual(1);
          });
        }
      }),
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] CompletionItemProvider - robustness', () => {
  it('should handle any position without crashing in arbitrary source', () => {
    fc.assert(
      fc.property(
        fc.string(),
        fc.nat(),
        fc.nat(),
        (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line + 1, col + 1);

          let didThrow = false;
          try {
            completionProvider.provideCompletionItems(model, position);
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      ROBUSTNESS_CONFIG,
    );
  });

  it('should handle any position without crashing in valid DBML schemas', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary,
        fc.nat(),
        fc.nat(),
        (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;
          const position = createPosition(line + 1, col + 1);

          let didThrow = false;
          try {
            completionProvider.provideCompletionItems(model, position);
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      FUZZ_CONFIG,
    );
  });

  it('should return valid result structure when completions are provided', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, fc.nat(), fc.nat(), (source: string, line: number, col: number) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const completionProvider = new DBMLCompletionItemProvider(compiler);
        const model = new MockTextModel(source) as any;

        const { line: clampedLine, col: clampedCol } = clampPosition(line, col, source);
        const position = createPosition(clampedLine + 1, clampedCol + 1);

        const result = completionProvider.provideCompletionItems(model, position);

        // Result should have valid structure
        if (result && result.suggestions) {
          expect(result.suggestions).toBeInstanceOf(Array);
          result.suggestions.forEach((suggestion) => {
            expect(suggestion.label).toBeDefined();
            expect(suggestion.insertText).toBeDefined();
          });
        }
      }),
      FUZZ_CONFIG,
    );
  });
});

describe('[fuzz] services - consistency', () => {
  it('should produce consistent results when called multiple times', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, fc.nat(), fc.nat(), (source: string, line: number, col: number) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;
        const position = createPosition(line + 1, col + 1);

        const result1 = definitionProvider.provideDefinition(model, position);
        const result2 = definitionProvider.provideDefinition(model, position);

        // Results should be structurally equivalent
        if (result1 === null) {
          expect(result2).toBeNull();
        } else if (Array.isArray(result1)) {
          expect(Array.isArray(result2)).toBe(true);
          expect((result2 as any[]).length).toBe(result1.length);
        }
      }),
      FUZZ_CONFIG,
    );
  });

  it('should handle source updates without crashing', () => {
    fc.assert(
      fc.property(
        dbmlSchemaArbitrary,
        dbmlSchemaArbitrary,
        fc.nat(),
        fc.nat(),
        (source1: string, source2: string, line: number, col: number) => {
          const compiler = new Compiler();

          // Set first source
          compiler.setSource(source1);
          const model1 = new MockTextModel(source1) as any;
          const definitionProvider = new DBMLDefinitionProvider(compiler);

          let didThrow = false;
          try {
            definitionProvider.provideDefinition(model1, createPosition(1, 1));

            // Update source
            compiler.setSource(source2);
            const model2 = new MockTextModel(source2) as any;

            definitionProvider.provideDefinition(model2, createPosition(line + 1, col + 1));
          } catch {
            didThrow = true;
          }
          expect(didThrow).toBe(false);
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('[fuzz] services - edge cases', () => {
  it('should handle empty source', () => {
    const compiler = new Compiler();
    compiler.setSource('');

    const model = new MockTextModel('') as any;
    const position = createPosition(1, 1);

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const referencesProvider = new DBMLReferencesProvider(compiler);
    const completionProvider = new DBMLCompletionItemProvider(compiler);

    expect(() => definitionProvider.provideDefinition(model, position)).not.toThrow();
    expect(() => referencesProvider.provideReferences(model, position)).not.toThrow();
    expect(() => completionProvider.provideCompletionItems(model, position)).not.toThrow();
  });

  it('should handle position beyond source bounds', () => {
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const model = new MockTextModel(source) as any;

        // Position way beyond source
        const position = createPosition(10000, 10000);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const referencesProvider = new DBMLReferencesProvider(compiler);
        const completionProvider = new DBMLCompletionItemProvider(compiler);

        let didThrow = false;
        try {
          definitionProvider.provideDefinition(model, position);
          referencesProvider.provideReferences(model, position);
          completionProvider.provideCompletionItems(model, position);
        } catch {
          didThrow = true;
        }
        expect(didThrow).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('should handle zero/negative positions', () => {
    fc.assert(
      fc.property(tableArbitrary, (source: string) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const model = new MockTextModel(source) as any;

        // Zero position (should be treated as 1,1)
        const position = createPosition(0, 0);

        const definitionProvider = new DBMLDefinitionProvider(compiler);

        let didThrow = false;
        try {
          definitionProvider.provideDefinition(model, position);
        } catch {
          didThrow = true;
        }
        expect(didThrow).toBe(false);
      }),
      { numRuns: 50 },
    );
  });

  it('should handle very long single-line source', () => {
    const longLine = 'Table t { ' + 'col int '.repeat(1000) + '}';
    const compiler = new Compiler();
    compiler.setSource(longLine);

    const model = new MockTextModel(longLine) as any;

    const definitionProvider = new DBMLDefinitionProvider(compiler);
    const completionProvider = new DBMLCompletionItemProvider(compiler);

    // Test at various positions
    [1, 100, 500, 1000].forEach((col) => {
      expect(() => {
        definitionProvider.provideDefinition(model, createPosition(1, col));
        completionProvider.provideCompletionItems(model, createPosition(1, col));
      }).not.toThrow();
    });
  });

  it('should handle source with many lines', () => {
    const manyLines = Array.from({ length: 500 }, (_, i) => `Table t${i} { id int }`).join('\n');
    const compiler = new Compiler();
    compiler.setSource(manyLines);

    const model = new MockTextModel(manyLines) as any;
    const definitionProvider = new DBMLDefinitionProvider(compiler);

    // Test at various line positions
    [1, 100, 250, 500].forEach((line) => {
      expect(() => {
        definitionProvider.provideDefinition(model, createPosition(line, 1));
      }).not.toThrow();
    });
  });
});

describe('[fuzz] services - unicode handling', () => {
  it('should handle unicode identifiers', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1, maxLength: 20 }), (name: string) => {
        // Escape special characters for valid DBML
        const safeName = name.replace(/["\n\r\\\0]/g, '');
        if (safeName.length === 0) return;

        const source = `Table "${safeName}" { id int }`;
        const compiler = new Compiler();
        compiler.setSource(source);

        const model = new MockTextModel(source) as any;
        const definitionProvider = new DBMLDefinitionProvider(compiler);

        let didThrow = false;
        try {
          definitionProvider.provideDefinition(model, createPosition(1, 10));
        } catch {
          didThrow = true;
        }
        expect(didThrow).toBe(false);
      }),
      { numRuns: 50 },
    );
  });
});
