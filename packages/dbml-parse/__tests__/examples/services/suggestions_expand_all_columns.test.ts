import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createMockTextModel, createPosition } from '../../utils';

describe('[example - suggestions] Expand * to all columns in Records', () => {
  describe('nested records', () => {
    it('- should suggest "* (all columns)" in nested records column list', () => {
      const program = `Table users {
  id int
  name varchar
  email varchar

  records ()
}`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const suggestionProvider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(program);

      // Position after "records ("
      const position = createPosition(6, 12);
      const suggestions = suggestionProvider.provideCompletionItems(model, position);

      expect(suggestions).toBeDefined();
      expect(suggestions.suggestions.length).toBeGreaterThan(0);

      // Find the "* (all columns)" suggestion
      const expandAllSuggestion = suggestions.suggestions.find((s) => s.label === '* (all columns)');
      expect(expandAllSuggestion).toBeDefined();
      expect(expandAllSuggestion!.insertText).toBe('id, name, email');
    });
  });

  describe('top-level records', () => {
    it('- should suggest "* (all columns)" in top-level Records column list', () => {
      const program = `Table users {
  id int
  name varchar
  email varchar
}

Records users() {
}
`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const suggestionProvider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(program);

      // Position after "Records users(" - inside the parentheses
      const position = createPosition(7, 15);
      const suggestions = suggestionProvider.provideCompletionItems(model, position);

      expect(suggestions).toBeDefined();
      expect(suggestions.suggestions.length).toBeGreaterThan(0);

      // Find the "* (all columns)" suggestion
      const expandAllSuggestion = suggestions.suggestions.find((s) => s.label === '* (all columns)');
      expect(expandAllSuggestion).toBeDefined();
      expect(expandAllSuggestion!.insertText).toBe('id, name, email');
    });

    it('- should be the first suggestion', () => {
      const program = `Table products {
  product_id int
  product_name varchar
  price decimal
}

Records products(
`;
      const compiler = new Compiler();
      compiler.setSource(program);

      const suggestionProvider = new DBMLCompletionItemProvider(compiler);
      const model = createMockTextModel(program);

      // Position after "Records products("
      const position = createPosition(7, 17);
      const suggestions = suggestionProvider.provideCompletionItems(model, position);

      expect(suggestions).toBeDefined();
      expect(suggestions.suggestions.length).toBeGreaterThan(0);

      // The "* (all columns)" suggestion should be first
      expect(suggestions.suggestions[0].label).toBe('* (all columns)');
      expect(suggestions.suggestions[0].insertText).toBe('product_id, product_name, price');
    });
  });
});
