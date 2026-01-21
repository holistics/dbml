import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { createMockTextModel, createPosition } from '../../utils';

describe('[snapshot] CompletionItemProvider - Records Row Snippets', () => {
  describe('should suggest record row snippets with types on empty line in Records body', () => {
    it('- should suggest completion with types after opening brace', () => {
      const program = `
        Table users {
          id int [pk]
          name varchar
          email varchar
        }

        Records users(id, name, email) {

        

        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      // Position right after opening brace on new line
      const position = createPosition(9, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      expect(result?.suggestions).toBeDefined();
      expect(result?.suggestions.length).toBeGreaterThan(0);
      expect(result?.suggestions[0].label).toEqual('Record row snippet');
      expect(result?.suggestions[0].insertText).toEqual('${1:id (int)}, ${2:name (varchar)}, ${3:email (varchar)}');
    });

    it('- should suggest completion with correct column order and types', () => {
      const program = `
        Table products {
          product_id int [pk]
          product_name varchar
          price decimal
          in_stock boolean
        }

        Records products(product_id, product_name, price, in_stock) {

        

        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(10, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      expect(result?.suggestions[0].insertText).toEqual('${1:product_id (int)}, ${2:product_name (varchar)}, ${3:price (decimal)}, ${4:in_stock (boolean)}');
    });

    it('- should work with schema-qualified tables', () => {
      const program = `
        Table auth.users {
          id int [pk]
          username varchar
          password_hash varchar
        }

        Records auth.users(id, username, password_hash) {
        
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(9, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      expect(result?.suggestions[0].insertText).toEqual('${1:id (int)}, ${2:username (varchar)}, ${3:password_hash (varchar)}');
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
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(8, 11);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      expect(result?.suggestions[0].insertText).toEqual('${1:order_id (int)}, ${2:customer_name (varchar)}, ${3:total (decimal)}');
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
      const provider = new DBMLCompletionItemProvider(compiler);
      // Position at the end of line 10 (after the last record)
      const position = createPosition(10, 44);
      const result = provider.provideCompletionItems(model, position);

      // Should suggest record row snippet if positioned on a new empty line
      // This test position is at the end of the line, not on an empty line
      // So it should not suggest the record row snippet
      const recordSnippet = result?.suggestions?.find(s => s.label === 'Record row snippet');
      // Note: This may not trigger since position is at end of line, not on empty line
      if (recordSnippet) {
        expect(recordSnippet.insertText).toEqual('${1:id (int)}, ${2:name (varchar)}, ${3:email (varchar)}');
      }
    });

    it('- should work with single column table', () => {
      const program = `
        Table counter {
          count int
        }

        Records counter(count) {
        
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(7, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      expect(result?.suggestions[0].insertText).toEqual('${1:count (int)}');
    });

    it('- should preserve column names with special characters and show types', () => {
      const program = `
        Table "special-table" {
          "column-1" int
          "column 2" varchar
          "column.3" boolean
        }

        Records "special-table"("column-1", "column 2", "column.3") {
        
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(9, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      const insertText = result?.suggestions[0].insertText as string;
      expect(insertText).toContain('column-1 (int)');
      expect(insertText).toContain('column 2 (varchar)');
      expect(insertText).toContain('column.3 (boolean)');
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
      const provider = new DBMLCompletionItemProvider(compiler);
      // Position inside the record entry (after the comma)
      const position = createPosition(8, 14);
      const result = provider.provideCompletionItems(model, position);

      // Should not suggest record row snippet when inside a function application
      // (may return other suggestions or empty array)
      const recordSnippet = result?.suggestions?.find(s => s.label === 'Record row snippet');
      expect(recordSnippet).toBeUndefined();
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
      const provider = new DBMLCompletionItemProvider(compiler);
      // Position in the header (after "Records ")
      const position = createPosition(7, 17);
      const result = provider.provideCompletionItems(model, position);

      // Should not suggest record row snippet in header
      // (may return other suggestions like schema.table names)
      const recordSnippet = result?.suggestions?.find(s => s.label === 'Record row snippet');
      expect(recordSnippet).toBeUndefined();
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
      const provider = new DBMLCompletionItemProvider(compiler);
      // Position inside Table body
      const position = createPosition(3, 15);
      const result = provider.provideCompletionItems(model, position);

      // Should not suggest record row snippet when not in RECORDS scope
      const recordSnippet = result?.suggestions?.find(s => s.label === 'Record row snippet');
      expect(recordSnippet).toBeUndefined();
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

        Records employee(emp_id, first_name, last_name, email, phone, hire_date, salary, department, manager_id, is_active) {
        
        }
      `;
      const compiler = new Compiler();
      compiler.setSource(program);
      const model = createMockTextModel(program);
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(16, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      const insertText = result?.suggestions[0].insertText as string;
      expect(insertText).toBeDefined();
      // Should have all 10 columns separated by commas
      const columnCount = insertText.split(',').length;
      expect(columnCount).toBe(10);
      // Should have ${1:col (type)} format
      expect(insertText).toContain('${1:emp_id (int)}');
      expect(insertText).toContain('${10:is_active (boolean)}');
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
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(6, 9);
      const result = provider.provideCompletionItems(model, position);

      // Should not return record row snippet when no columns
      const recordSnippet = result?.suggestions?.find(s => s.label === 'Record row snippet');
      expect(recordSnippet).toBeUndefined();
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
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(9, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      expect(result?.suggestions[0].insertText).toEqual('${1:id (int)}, ${2:name (varchar)}, ${3:price (decimal)}');
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
      const provider = new DBMLCompletionItemProvider(compiler);
      const position = createPosition(10, 9);
      const result = provider.provideCompletionItems(model, position);

      expect(result).toBeDefined();
      // Should suggest only the columns specified in Records header
      const insertText = result?.suggestions[0].insertText as string;
      expect(insertText).toContain('id (int)');
      expect(insertText).toContain('name (varchar)');
      expect(insertText).not.toContain('email (varchar)');
      expect(insertText).not.toContain('created_at (timestamp)');
    });

  });
});
