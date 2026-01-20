import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createMockTextModel, createPosition } from '../../utils';

describe('[snapshot] CompletionItemProvider - Records', () => {
  describe('should NOT suggest record entry snippets in Records body (handled by inline completions)', () => {
    it('- should not suggest snippet in Records body', () => {
      const program = `
        Table users {
          id int [pk]
          name varchar
          email varchar

          records {

          }
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      // Position inside the Records body (between the braces)
      const position = createPosition(8, 13);
      const result = provider.provideCompletionItems(model, position);

      // Should NOT have record entry snippet - now handled by inline completions
      const recordEntrySnippet = result.suggestions.find((s) => s.label === 'Record entry');
      expect(recordEntrySnippet).toBeUndefined();
    });

    it('- should not suggest snippet in top-level Records body', () => {
      const program = `
        Table products {
          id int
          name varchar
        }

        Records products(id, name) {

        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(8, 11);
      const result = provider.provideCompletionItems(model, position);

      // Should NOT have record entry snippet - now handled by inline completions
      const recordEntrySnippet = result.suggestions.find((s) => s.label === 'Record entry');
      expect(recordEntrySnippet).toBeUndefined();
    });
  });
});
