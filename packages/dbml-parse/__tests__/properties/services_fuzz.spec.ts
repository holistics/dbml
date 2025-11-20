import { describe, expect, it } from 'vitest';
import * as fc from 'fast-check';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { smallSchemaArbitrary } from './arbitraries/grammars';
import { MockTextModel, createPosition } from '../mocks';

describe('DefinitionProvider', () => {
  it('should handle any position without crashing', () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(1000), fc.nat(1000), (source: string, line: number, col: number) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const definitionProvider = new DBMLDefinitionProvider(compiler);
        const model = new MockTextModel(source) as any;

        const position = createPosition(line + 1, col + 1);

        expect(() => {
          definitionProvider.provideDefinition(model, position);
        }).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});

describe('ReferencesProvider', () => {
  it('should handle any position without crashing', () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(1000), fc.nat(1000), (source: string, line: number, col: number) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const referencesProvider = new DBMLReferencesProvider(compiler);
        const model = new MockTextModel(source) as any;

        const position = createPosition(line + 1, col + 1);

        expect(() => {
          referencesProvider.provideReferences(model, position);
        }).not.toThrow();
      }),
      { numRuns: 100 },
    );
  });
});

describe('CompletionItemProvider', () => {
  it('should handle any position without crashing', () => {
    fc.assert(
      fc.property(fc.string(), fc.nat(1000), fc.nat(1000), (source: string, line: number, col: number) => {
        const compiler = new Compiler();
        compiler.setSource(source);

        const completionProvider = new DBMLCompletionItemProvider(compiler);
        const model = new MockTextModel(source) as any;

        const position = createPosition(line + 1, col + 1);

        expect(() => {
          completionProvider.provideCompletionItems(model, position);
        }).not.toThrow();
      }),
      { numRuns: 100 },
    );
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
