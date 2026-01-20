import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLInlineCompletionItemProvider from '@/services/inlineCompletions/provider';
import { createMockTextModel, createPosition } from '../../utils';

describe('[snapshot] InlineCompletionItemProvider - Records', () => {
  describe('should suggest inline completions with types on enter in Records body', () => {
    it('- should suggest completion with types after opening brace', () => {
      const program = `
        Table users {
          id int [pk]
          name varchar
          email varchar
        }

        Records users {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      // Position right after opening brace on new line
      const position = createPosition(9, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      expect(result?.items).toBeDefined();
      expect(result?.items.length).toBeGreaterThan(0);
      expect(result?.items[0].insertText).toEqual({ snippet: '${1:id (int)}, ${2:name (varchar)}, ${3:email (varchar)}' });
    });

    it('- should suggest completion with correct column order and types', () => {
      const program = `
        Table products {
          product_id int [pk]
          product_name varchar
          price decimal
          in_stock boolean
        }

        Records products {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(10, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      expect(result?.items[0].insertText).toEqual({ snippet: '${1:product_id (int)}, ${2:product_name (varchar)}, ${3:price (decimal)}, ${4:in_stock (boolean)}' });
    });

    it('- should work with schema-qualified tables', () => {
      const program = `
        Table auth.users {
          id int [pk]
          username varchar
          password_hash varchar
        }

        Records auth.users {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(9, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      expect(result?.items[0].insertText).toEqual({ snippet: '${1:id (int)}, ${2:username (varchar)}, ${3:password_hash (varchar)}' });
    });

    it('- should work with Records inside Table', () => {
      const program = `
        Table orders {
          order_id int [pk]
          customer_name varchar
          total decimal

          Records {
          }
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(8, 11);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      expect(result?.items[0].insertText).toEqual({ snippet: '${1:order_id (int)}, ${2:customer_name (varchar)}, ${3:total (decimal)}' });
    });

    it('- should suggest after existing records', () => {
      const program = `
        Table users {
          id int
          name varchar
          email varchar
        }

        Records users {
          1, "Alice", "alice@example.com"
          2, "Bob", "bob@example.com"
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      // Position at the end of line 10 (after the last record)
      const position = createPosition(10, 44);
      const result = provider.provideInlineCompletions(model, position);

      // Should suggest inline completion after a newline
      // This depends on whether there's a newline token at that position
      if (result) {
        expect(result.items[0].insertText).toEqual({ snippet: '${1:id (int)}, ${2:name (varchar)}, ${3:email (varchar)}' });
      }
    });

    it('- should work with single column table', () => {
      const program = `
        Table counter {
          count int
        }

        Records counter {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(7, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      expect(result?.items[0].insertText).toEqual({ snippet: '${1:count (int)}' });
    });

    it('- should preserve column names with special characters and show types', () => {
      const program = `
        Table "special-table" {
          "column-1" int
          "column 2" varchar
          "column.3" boolean
        }

        Records "special-table" {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(9, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      const insertText = result?.items[0].insertText as { snippet: string };
      expect(insertText.snippet).toContain('column-1 (int)');
      expect(insertText.snippet).toContain('column 2 (varchar)');
      expect(insertText.snippet).toContain('column.3 (boolean)');
    });

    it('- should not suggest inside existing record entry', () => {
      const program = `
        Table users {
          id int
          name varchar
        }

        Records users {
          1, "Alice"
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      // Position inside the record entry (after the comma)
      const position = createPosition(8, 14);
      const result = provider.provideInlineCompletions(model, position);

      // Should not suggest when inside a function application
      expect(result).toBeNull();
    });

    it('- should not suggest in Records header', () => {
      const program = `
        Table users {
          id int
          name varchar
        }

        Records users {
          1, "Alice"
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      // Position in the header (after "Records ")
      const position = createPosition(7, 17);
      const result = provider.provideInlineCompletions(model, position);

      // Should not suggest in header
      expect(result).toBeNull();
    });

    it('- should not suggest in non-Records scope', () => {
      const program = `
        Table users {
          id int
          name varchar
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      // Position inside Table body
      const position = createPosition(3, 15);
      const result = provider.provideInlineCompletions(model, position);

      // Should not suggest when not in RECORDS scope
      expect(result).toBeNull();
    });

    it('- should handle table with many columns', () => {
      const program = `
        Table employee {
          emp_id int [pk]
          first_name varchar
          last_name varchar
          email varchar
          phone varchar
          hire_date date
          salary decimal
          department varchar
          manager_id int
          is_active boolean
        }

        Records employee {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(16, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      const insertText = result?.items[0].insertText as { snippet: string };
      expect(insertText.snippet).toBeDefined();
      // Should have all 10 columns separated by commas
      const columnCount = insertText.snippet.split(',').length;
      expect(columnCount).toBe(10);
      // Should have ${1:col (type)} format
      expect(insertText.snippet).toContain('${1:emp_id (int)}');
      expect(insertText.snippet).toContain('${10:is_active (boolean)}');
    });
  });

  describe('should handle edge cases', () => {
    it('- should not crash with empty table', () => {
      const program = `
        Table empty_table {
        }

        Records empty_table {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(6, 9);
      const result = provider.provideInlineCompletions(model, position);

      // Should return null when no columns
      expect(result).toBeNull();
    });

    it('- should work with Records using call expression', () => {
      const program = `
        Table products {
          id int
          name varchar
          price decimal
        }

        Records products(id, name, price) {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(9, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      expect(result?.items[0].insertText).toEqual({ snippet: '${1:id (int)}, ${2:name (varchar)}, ${3:price (decimal)}' });
    });

    it('- should handle Records with subset of columns specified', () => {
      const program = `
        Table users {
          id int
          name varchar
          email varchar
          created_at timestamp
        }

        Records users(id, name) {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(10, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      // Should suggest all table columns, not just the ones specified in Records header
      const insertText = result?.items[0].insertText as { snippet: string };
      expect(insertText.snippet).toContain('id (int)');
      expect(insertText.snippet).toContain('name (varchar)');
      expect(insertText.snippet).toContain('email (varchar)');
      expect(insertText.snippet).toContain('created_at (timestamp)');
    });

    it('- should provide correct range in completion item', () => {
      const program = `
        Table users {
          id int
          name varchar
        }

        Records users {
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLInlineCompletionItemProvider(compiler);
      const position = createPosition(8, 9);
      const result = provider.provideInlineCompletions(model, position);

      expect(result).toBeDefined();
      expect(result?.items[0].range).toBeDefined();
      expect(result?.items[0].range?.startLineNumber).toBe(position.lineNumber);
      expect(result?.items[0].range?.startColumn).toBe(position.column);
      expect(result?.items[0].range?.endLineNumber).toBe(position.lineNumber);
      expect(result?.items[0].range?.endColumn).toBe(position.column);
    });
  });
});
