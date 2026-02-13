import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createMockTextModel, createPosition } from '@tests/utils';
import { getColumnsFromTableSymbol } from '@/services/suggestions/utils';
import { TableSymbol } from '@/core/analyzer/symbol/symbols';

describe('[example] CompletionItemProvider - Records', () => {
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

describe('[example] Expand * to all columns in Records', () => {
  describe('nested records', () => {
    it('- should suggest "* (all)" in nested records column list', () => {
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

      // Verify suggestions exist with exact count
      expect(suggestions.suggestions.length).toBe(4); // 3 columns + 1 "* (all)"

      // Verify "* (all)" suggestion is present
      const expandAllSuggestion = suggestions.suggestions.find((s) => s.label === '* (all)');
      expect(expandAllSuggestion).not.toBeUndefined();
      expect(expandAllSuggestion!.insertText).toBe('id, name, email');

      // Verify individual column suggestions
      const columnSuggestions = suggestions.suggestions.filter((s) => s.label !== '* (all)');
      expect(columnSuggestions.length).toBe(3);
      expect(columnSuggestions[0].label).toBe('id');
      expect(columnSuggestions[1].label).toBe('name');
      expect(columnSuggestions[2].label).toBe('email');
    });
  });

  describe('top-level records', () => {
    it('- should suggest "* (all)" in top-level Records column list', () => {
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

      // Verify exact suggestion count
      expect(suggestions.suggestions.length).toBe(4); // 3 columns + 1 "* (all)"

      // Verify "* (all)" suggestion exists
      const expandAllSuggestion = suggestions.suggestions.find((s) => s.label === '* (all)');
      expect(expandAllSuggestion).not.toBeUndefined();
      expect(expandAllSuggestion!.insertText).toBe('id, name, email');

      // Verify all column suggestions
      expect(suggestions.suggestions[1].label).toBe('id');
      expect(suggestions.suggestions[2].label).toBe('name');
      expect(suggestions.suggestions[3].label).toBe('email');
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

      // Verify exact suggestion count
      expect(suggestions.suggestions.length).toBe(4); // 3 columns + 1 "* (all)"

      // The "* (all)" suggestion should be first
      expect(suggestions.suggestions[0].label).toBe('* (all)');
      expect(suggestions.suggestions[0].insertText).toBe('product_id, product_name, price');

      // Verify column suggestions follow
      expect(suggestions.suggestions[1].label).toBe('product_id');
      expect(suggestions.suggestions[2].label).toBe('product_name');
      expect(suggestions.suggestions[3].label).toBe('price');
    });
  });
});

describe('[example] Suggestions Utils - Records', () => {
  describe('getColumnsFromTableSymbol', () => {
    it('- should extract columns from table with partial table injection', () => {
      const program = `
        TablePartial id {
          id int [pk]
        }

        TablePartial timestamps {
          created_at timestamp
          updated_at timestamp
        }

        Table users {
          ~id
          name varchar
          ~timestamps
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[2]; // users table is the third element
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        // Verify exact column count
        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(4);

        // Verify all expected columns are present with correct types
        // Note: Column order follows declaration order in table, not injection order
        const columnMap = new Map(columns!.map((col) => [col.name, col.type]));
        expect(columnMap.get('id')).toBe('int');
        expect(columnMap.get('name')).toBe('varchar');
        expect(columnMap.get('created_at')).toBe('timestamp');
        expect(columnMap.get('updated_at')).toBe('timestamp');
      }
    });

    it('- should handle table with only injected columns', () => {
      const program = `
        TablePartial base {
          id int
          created_at timestamp
        }

        Table entities {
          ~base
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[1];
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(2);
        expect(columns![0].name).toBe('id');
        expect(columns![0].type).toBe('int');
        expect(columns![1].name).toBe('created_at');
        expect(columns![1].type).toBe('timestamp');
      }
    });

    it('- should handle mixed regular and injected columns', () => {
      const program = `
        TablePartial metadata {
          version int
        }

        Table products {
          product_id int [pk]
          ~metadata
          name varchar
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[1];
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        // Verify exact column count
        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(3);

        // Verify all expected columns are present with correct types
        const columnMap = new Map(columns!.map((col) => [col.name, col.type]));
        expect(columnMap.get('product_id')).toBe('int');
        expect(columnMap.get('version')).toBe('int');
        expect(columnMap.get('name')).toBe('varchar');
      }
    });

    it('- should extract columns with types from table symbol', () => {
      const program = `
        Table users {
          id int [pk]
          name varchar
          email varchar
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._(); // Trigger parsing

      // Get the table symbol
      const ast = compiler.parse.ast();
      const tableElement = ast.body[0];
      const tableSymbol = tableElement.symbol;

      expect(tableSymbol).toBeInstanceOf(TableSymbol);

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        // Verify exact column count and properties
        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(3);
        expect(columns![0].name).toBe('id');
        expect(columns![0].type).toBe('int');
        expect(columns![1].name).toBe('name');
        expect(columns![1].type).toBe('varchar');
        expect(columns![2].name).toBe('email');
        expect(columns![2].type).toBe('varchar');
      }
    });

    it('- should maintain column order and extract types', () => {
      const program = `
        Table products {
          product_id int [pk]
          product_name varchar
          price decimal
          in_stock boolean
          created_at timestamp
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[0];
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        // Verify exact column count
        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(5);

        // Verify all columns in exact order with exact types
        expect(columns![0].name).toBe('product_id');
        expect(columns![0].type).toBe('int');
        expect(columns![1].name).toBe('product_name');
        expect(columns![1].type).toBe('varchar');
        expect(columns![2].name).toBe('price');
        expect(columns![2].type).toBe('decimal');
        expect(columns![3].name).toBe('in_stock');
        expect(columns![3].type).toBe('boolean');
        expect(columns![4].name).toBe('created_at');
        expect(columns![4].type).toBe('timestamp');
      }
    });

    it('- should handle table with single column', () => {
      const program = `
        Table counter {
          count int
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[0];
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        // Verify exact single column
        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(1);
        expect(columns![0].name).toBe('count');
        expect(columns![0].type).toBe('int');
      }
    });

    it('- should handle quoted column names', () => {
      const program = `
        Table "special-table" {
          "column-1" int
          "column 2" varchar
          "column.3" boolean
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[0];
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        // Verify exact columns with special characters
        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(3);
        expect(columns![0].name).toBe('column-1');
        expect(columns![0].type).toBe('int');
        expect(columns![1].name).toBe('column 2');
        expect(columns![1].type).toBe('varchar');
        expect(columns![2].name).toBe('column.3');
        expect(columns![2].type).toBe('boolean');
      }
    });

    it('- should return empty array for empty table', () => {
      const program = `
        Table empty_table {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[0];
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(0);
      }
    });

    it('- should only extract columns, not other symbols', () => {
      const program = `
        Table users {
          id int [pk]
          name varchar

          indexes {
            (id, name)
          }
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[0];
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        // Verify only columns are extracted, not indexes
        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(2);
        expect(columns![0].name).toBe('id');
        expect(columns![0].type).toBe('int');
        expect(columns![1].name).toBe('name');
        expect(columns![1].type).toBe('varchar');
      }
    });

    it('- should work with schema-qualified tables', () => {
      const program = `
        Table auth.users {
          id int [pk]
          username varchar
          password_hash varchar
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      compiler.parse._();

      const ast = compiler.parse.ast();
      const tableElement = ast.body[0];
      const tableSymbol = tableElement.symbol;

      if (tableSymbol instanceof TableSymbol) {
        const columns = getColumnsFromTableSymbol(tableSymbol);

        // Verify schema-qualified table columns
        expect(columns).not.toBeNull();
        expect(columns!.length).toBe(3);
        expect(columns![0].name).toBe('id');
        expect(columns![0].type).toBe('int');
        expect(columns![1].name).toBe('username');
        expect(columns![1].type).toBe('varchar');
        expect(columns![2].name).toBe('password_hash');
        expect(columns![2].type).toBe('varchar');
      }
    });
  });
});
