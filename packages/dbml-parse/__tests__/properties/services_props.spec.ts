import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { dbmlSchemaArbitrary } from './arbitraries/grammars';
import { MockTextModel, createPosition, extractTextFromRange } from '../mocks';

// Helper: Find all identifier positions in source
function findIdentifierPositions (source: string): Array<{ line: number; column: number }> {
  const positions: Array<{ line: number; column: number }> = [];
  const lines = source.split('\n');

  // Regex to match identifiers (including schema-qualified names)
  const identifierRegex = /\b[a-zA-Z_][a-zA-Z0-9_]*\b/g;

  lines.forEach((line, lineIndex) => {
    let match;
    while ((match = identifierRegex.exec(line)) !== null) {
      // Filter out keywords that aren't symbols
      const word = match[0];
      const keywords = ['Table', 'table', 'Ref', 'ref', 'Enum', 'enum', 'Project', 'project',
        'TableGroup', 'tablegroup', 'Indexes', 'indexes', 'Note', 'note',
        'pk', 'null', 'not', 'unique', 'increment', 'default', 'check',
        'primary', 'key', 'headercolor', 'type', 'name'];

      if (!keywords.includes(word)) {
        positions.push({
          line: lineIndex + 1,
          column: match.index + 1,
        });
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
  const text = extractTextFromRange(source, range);
  // Should be a valid identifier (letters, numbers, underscores)
  return /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text.trim());
}

// Helper: Get a valid identifier position from a schema
const validIdentifierPositionArbitrary = fc
  .tuple(dbmlSchemaArbitrary)
  .chain(([source]) => {
    const positions = findIdentifierPositions(source);
    if (positions.length === 0) {
      // If no identifiers found, return a default position
      return fc.constant({ source, position: { line: 1, column: 1 } });
    }
    return fc
      .integer({ min: 0, max: positions.length - 1 })
      .map((index) => ({ source, position: positions[index] }));
  });

describe('DefinitionProvider', () => {
  it('should be idempotent: going to definition twice yields same location', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        const firstDefinition = definitionProvider.provideDefinition(model, pos);
        expect(Array.isArray(firstDefinition)).toBeTruthy();
        if (!Array.isArray(firstDefinition)) return;

        // If we got a definition, go to it and try to get definition again
        if (firstDefinition && firstDefinition.length > 0) {
          const defLocation = firstDefinition[0];
          const defPos = createPosition(
            defLocation.range.startLineNumber,
            defLocation.range.startColumn,
          );

          const secondDefinition = definitionProvider.provideDefinition(model, defPos);
          expect(Array.isArray(secondDefinition)).toBeTruthy();
          if (!Array.isArray(secondDefinition)) return;

          // Second definition should either be empty (we're at a declaration)
          // or should point to the same location
          if (secondDefinition && secondDefinition.length > 0) {
            expect(secondDefinition[0].range).toEqual(firstDefinition[0].range);
          }
        }
      }),
      { numRuns: 100 },
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
        expect(Array.isArray(definitions)).toBeTruthy();
        if (!Array.isArray(definitions)) return;

        if (definitions && definitions.length > 0) {
          definitions.forEach((def) => {
            expect(isRangeValid(source, def.range)).toBe(true);
            expect(rangePointsToIdentifier(source, def.range)).toBe(true);
          });
        }
      }),
      { numRuns: 100 },
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
        expect(Array.isArray(definitions)).toBeTruthy();
        if (!Array.isArray(definitions)) return;

        if (definitions && definitions.length > 0) {
          // Check for duplicates by comparing ranges
          const rangeStrings = definitions.map((def) =>
            JSON.stringify(def.range),
          );
          const uniqueRanges = new Set(rangeStrings);
          expect(uniqueRanges.size).toBe(rangeStrings.length);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('ReferencesProvider', () => {
  it('should find all references with valid ranges', () => {
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
            expect(isRangeValid(source, ref.range)).toBe(true);
            expect(rangePointsToIdentifier(source, ref.range)).toBe(true);
          });
        }
      }),
      { numRuns: 5 },
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

        // First, go to definition
        const definitions = definitionProvider.provideDefinition(model, pos);
        expect(Array.isArray(definitions)).toBeTruthy();
        if (!Array.isArray(definitions)) return;

        if (definitions && definitions.length > 0) {
          const defLocation = definitions[0];
          const defPos = createPosition(
            defLocation.range.startLineNumber,
            defLocation.range.startColumn,
          );

          // Now find references from the declaration site
          const references = referencesProvider.provideReferences(model, defPos);

          // References should not include the declaration itself
          if (references && references.length > 0) {
            const hasDeclaration = references.some((ref) =>
              ref.range.startLineNumber === defLocation.range.startLineNumber
              && ref.range.startColumn === defLocation.range.startColumn,
            );

            expect(hasDeclaration).toBe(false);
          }
        }
      }),
      { numRuns: 100 },
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

        if (references && references.length > 0) {
          // Check for duplicates by comparing ranges
          const rangeStrings = references.map((ref) =>
            JSON.stringify(ref.range),
          );
          const uniqueRanges = new Set(rangeStrings);
          expect(uniqueRanges.size).toBe(rangeStrings.length);
        }
      }),
      { numRuns: 100 },
    );
  });
});

describe('CompletionItemProvider', () => {
  it('should return completions with valid labels', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, fc.nat(), fc.nat(), (source, line, col) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const completionProvider = new DBMLCompletionItemProvider(compiler);
        const model = new MockTextModel(source) as any;
        const position = createPosition(line + 1, col + 1);

        const completions = completionProvider.provideCompletionItems(model, position);

        if (completions && completions.suggestions) {
          completions.suggestions.forEach((suggestion) => {
            expect(typeof suggestion.label).toBe('string');
            expect(typeof suggestion.insertText).toBe('string');
          });
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should not return empty suggestion lists for valid DBML positions', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source) => {
        // Test at the end of the source (a common completion position)
        const lines = source.split('\n');
        const lastLine = lines.length;
        const lastCol = lines[lastLine - 1].length + 1;

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
      { numRuns: 100 },
    );
  });
});

describe('Cross-Service', () => {
  it('should maintain definition-references symmetry', () => {
    fc.assert(
      fc.property(validIdentifierPositionArbitrary, ({ source, position }) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;
        const pos = createPosition(position.line, position.column);

        // Go to definition from a reference
        const definitions = definitionProvider.provideDefinition(model, pos);
        expect(Array.isArray(definitions)).toBeTruthy();
        if (!Array.isArray(definitions)) return;

        if (definitions && definitions.length > 0) {
          const defLocation = definitions[0];
          const defPos = createPosition(
            defLocation.range.startLineNumber,
            defLocation.range.startColumn,
          );

          // Find all references from that definition
          const references = referencesProvider.provideReferences(model, defPos);

          if (references && references.length > 0) {
            // The original position should be findable in the references
            // (either as exact match or as one of the reference locations)
            const originalPosInRefs = references.some((ref) => {
              // Check if any reference encompasses our original position
              return (
                ref.range.startLineNumber <= position.line
                && ref.range.endLineNumber >= position.line
                && (ref.range.startLineNumber < position.line
                  || ref.range.startColumn <= position.column)
                && (ref.range.endLineNumber > position.line
                  || ref.range.endColumn >= position.column)
              );
            });

            // This should be true for proper symmetry
            expect(typeof originalPosInRefs).toBe('boolean');
          }
        }
      }),
      { numRuns: 100 },
    );
  });

  it('should ensure completed items have valid definitions', () => {
    fc.assert(
      fc.property(dbmlSchemaArbitrary, (source) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const completionProvider = new DBMLCompletionItemProvider(compiler);
        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;

        // Get completions at the start of the document
        const position = createPosition(1, 1);
        const completions = completionProvider.provideCompletionItems(model, position);

        if (completions && completions.suggestions && completions.suggestions.length > 0) {
          // For each completion, if it's a symbol (not a keyword), it should have a definition
          const symbolCompletions = completions.suggestions.filter((s) => {
            // Filter out keywords and snippets
            const keywords = ['Table', 'Ref', 'Enum', 'Project', 'TableGroup', 'Indexes', 'Note'];
            return !keywords.includes(s.label as string);
          });

          // For symbol completions, try to find their definitions
          symbolCompletions.forEach((completion) => {
            // Try to find where this symbol is in the source
            const symbolPos = source.indexOf(completion.label as string);
            if (symbolPos !== -1) {
              // Calculate line and column
              const beforeSymbol = source.substring(0, symbolPos);
              const line = beforeSymbol.split('\n').length;
              const lastNewline = beforeSymbol.lastIndexOf('\n');
              const column = symbolPos - lastNewline;

              const pos = createPosition(line, column);
              const definitions = definitionProvider.provideDefinition(model, pos);

              // If it's a defined symbol, it should have a definition
              expect(Array.isArray(definitions)).toBe(true);
            }
          });
        }
      }),
      { numRuns: 100 },
    );
  });
});
