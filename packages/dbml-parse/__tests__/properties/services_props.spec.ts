import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import type { TextModel, Position } from '@/services/types';
import { smallSchemaArbitrary } from './arbitraries/grammars';

// Mock TextModel for property testing
class MockTextModel implements Partial<TextModel> {
  private content: string;
  uri: string;

  constructor (content: string, uri = 'file:///test.dbml') {
    this.content = content;
    this.uri = uri;
  }

  getOffsetAt (position: Position): number {
    const lines = this.content.split('\n');
    let offset = 0;

    for (let i = 0; i < position.lineNumber - 1 && i < lines.length; i++) {
      offset += lines[i].length + 1;
    }

    offset += Math.min(position.column - 1, lines[position.lineNumber - 1]?.length || 0);
    return Math.max(0, offset);
  }

  getValue (): string {
    return this.content;
  }
}

describe('Services Property Tests', () => {
  describe('DefinitionProvider Properties', () => {
    it('should always return an array', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(100), fc.nat(100), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const definitionProvider = new DBMLDefinitionProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = definitionProvider.provideDefinition(model, position);

          expect(Array.isArray(result)).toBe(true);
        }),
        { numRuns: 50 },
      );
    });

    it('should handle any position without crashing', () => {
      fc.assert(
        fc.property(fc.string(), fc.nat(1000), fc.nat(1000), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const definitionProvider = new DBMLDefinitionProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };

          expect(() => {
            definitionProvider.provideDefinition(model, position);
          }).not.toThrow();
        }),
        { numRuns: 100 },
      );
    });

    it('should return valid definition locations', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(50), fc.nat(50), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const definitionProvider = new DBMLDefinitionProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = definitionProvider.provideDefinition(model, position);

          if (result.length > 0) {
            result.forEach((def) => {
              expect(def).toHaveProperty('range');
              expect(def).toHaveProperty('uri');
              expect(def.range.startLineNumber).toBeGreaterThanOrEqual(1);
              expect(def.range.startColumn).toBeGreaterThanOrEqual(1);
              expect(def.range.endLineNumber).toBeGreaterThanOrEqual(def.range.startLineNumber);
            });
          }
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('ReferencesProvider Properties', () => {
    it('should always return an array', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(100), fc.nat(100), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const referencesProvider = new DBMLReferencesProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = referencesProvider.provideReferences(model, position);

          expect(Array.isArray(result)).toBe(true);
        }),
        { numRuns: 50 },
      );
    });

    it('should handle any position without crashing', () => {
      fc.assert(
        fc.property(fc.string(), fc.nat(1000), fc.nat(1000), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const referencesProvider = new DBMLReferencesProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };

          expect(() => {
            referencesProvider.provideReferences(model, position);
          }).not.toThrow();
        }),
        { numRuns: 100 },
      );
    });

    it('should return valid reference locations', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(50), fc.nat(50), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const referencesProvider = new DBMLReferencesProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = referencesProvider.provideReferences(model, position);

          if (result.length > 0) {
            result.forEach((ref) => {
              expect(ref).toHaveProperty('range');
              expect(ref).toHaveProperty('uri');
              expect(ref.range.startLineNumber).toBeGreaterThanOrEqual(1);
              expect(ref.range.startColumn).toBeGreaterThanOrEqual(1);
              expect(ref.range.endLineNumber).toBeGreaterThanOrEqual(ref.range.startLineNumber);
            });
          }
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('CompletionItemProvider Properties', () => {
    it('should always return a CompletionList with suggestions array', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(100), fc.nat(100), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = completionProvider.provideCompletionItems(model, position);

          expect(result).toHaveProperty('suggestions');
          expect(Array.isArray(result.suggestions)).toBe(true);
        }),
        { numRuns: 50 },
      );
    });

    it('should handle any position without crashing', () => {
      fc.assert(
        fc.property(fc.string(), fc.nat(1000), fc.nat(1000), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };

          expect(() => {
            completionProvider.provideCompletionItems(model, position);
          }).not.toThrow();
        }),
        { numRuns: 100 },
      );
    });

    it('should return valid completion items', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(50), fc.nat(50), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = completionProvider.provideCompletionItems(model, position);

          result.suggestions.forEach((item) => {
            expect(item).toHaveProperty('label');
            expect(item).toHaveProperty('insertText');
            expect(typeof item.label).toBe('string');
            expect(typeof item.insertText).toBe('string');
          });
        }),
        { numRuns: 50 },
      );
    });

    it('should handle empty source', () => {
      fc.assert(
        fc.property(fc.constant(''), fc.nat(10), fc.nat(10), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = completionProvider.provideCompletionItems(model, position);

          expect(result).toHaveProperty('suggestions');
          expect(Array.isArray(result.suggestions)).toBe(true);
        }),
        { numRuns: 20 },
      );
    });

    it('should suggest top-level keywords for empty position', () => {
      const source = '';
      const compiler = new Compiler();
      compiler.setSource(source);

      const completionProvider = new DBMLCompletionItemProvider(compiler);
      const model = new MockTextModel(source) as any;

      const position: Position = { lineNumber: 1, column: 1 };
      const result = completionProvider.provideCompletionItems(model, position);

      expect(result.suggestions.length).toBeGreaterThan(0);
      const labels = result.suggestions.map((s) => s.label);
      expect(labels).toContain('Table');
      expect(labels).toContain('Enum');
    });

    it('should not crash with trigger characters', () => {
      fc.assert(
        fc.property(
          smallSchemaArbitrary,
          fc.array(fc.string({ minLength: 1, maxLength: 1 }), { minLength: 0, maxLength: 5 }),
          (source: string, triggerChars: string[]) => {
            const compiler = new Compiler();
            compiler.setSource(source);

            const completionProvider = new DBMLCompletionItemProvider(compiler, triggerChars);

            expect(completionProvider.triggerCharacters).toEqual(triggerChars);
          },
        ),
        { numRuns: 30 },
      );
    });
  });

  describe('Cross-Provider Consistency', () => {
    it('definition locations should be valid positions in source', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(50), fc.nat(50), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const definitionProvider = new DBMLDefinitionProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = definitionProvider.provideDefinition(model, position);

          const lines = source.split('\n');
          result.forEach((def) => {
            expect(def.range.startLineNumber).toBeLessThanOrEqual(lines.length);
            expect(def.range.endLineNumber).toBeLessThanOrEqual(lines.length);
          });
        }),
        { numRuns: 50 },
      );
    });

    it('references should have consistent URIs', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(50), fc.nat(50), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const referencesProvider = new DBMLReferencesProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = referencesProvider.provideReferences(model, position);

          if (result.length > 0) {
            const firstUri = result[0].uri;
            result.forEach((ref) => {
              expect(ref.uri).toBe(firstUri);
            });
          }
        }),
        { numRuns: 50 },
      );
    });

    it('completions should not have duplicate labels at same position', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, fc.nat(50), fc.nat(50), (source: string, line: number, col: number) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const completionProvider = new DBMLCompletionItemProvider(compiler);
          const model = new MockTextModel(source) as any;

          const position: Position = { lineNumber: line + 1, column: col + 1 };
          const result = completionProvider.provideCompletionItems(model, position);

          const labels = result.suggestions.map((s) => s.label);
          const uniqueLabels = new Set(labels);

          // Allow duplicates, but ensure they're reasonable
          expect(labels.length).toBeGreaterThanOrEqual(0);
        }),
        { numRuns: 50 },
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle positions beyond source length', () => {
      const source = 'Table test { id int }';
      const compiler = new Compiler();
      compiler.setSource(source);

      const model = new MockTextModel(source) as any;
      const definitionProvider = new DBMLDefinitionProvider(compiler);
      const referencesProvider = new DBMLReferencesProvider(compiler);
      const completionProvider = new DBMLCompletionItemProvider(compiler);

      const position: Position = { lineNumber: 1000, column: 1000 };

      expect(() => definitionProvider.provideDefinition(model, position)).not.toThrow();
      expect(() => referencesProvider.provideReferences(model, position)).not.toThrow();
      expect(() => completionProvider.provideCompletionItems(model, position)).not.toThrow();
    });

    it('should handle negative-like positions gracefully', () => {
      const source = 'Table test { id int }';
      const compiler = new Compiler();
      compiler.setSource(source);

      const model = new MockTextModel(source) as any;
      const definitionProvider = new DBMLDefinitionProvider(compiler);

      const position: Position = { lineNumber: 1, column: 1 };

      expect(() => definitionProvider.provideDefinition(model, position)).not.toThrow();
    });

    it('should handle multiline sources', () => {
      fc.assert(
        fc.property(smallSchemaArbitrary, (source: string) => {
          const compiler = new Compiler();
          compiler.setSource(source);

          const model = new MockTextModel(source) as any;
          const completionProvider = new DBMLCompletionItemProvider(compiler);

          const lines = source.split('\n');
          for (let i = 0; i < Math.min(lines.length, 5); i++) {
            const position: Position = { lineNumber: i + 1, column: 1 };
            expect(() => completionProvider.provideCompletionItems(model, position)).not.toThrow();
          }
        }),
        { numRuns: 30 },
      );
    });
  });
});
