import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import { generateRecordEntrySnippet, getColumnsFromTableSymbol } from '@/services/suggestions/utils';
import { TableSymbol } from '@/core/analyzer/symbol/symbols';

describe('[unit] Suggestions Utils - Records', () => {
  describe('generateRecordEntrySnippet', () => {
    it('- should generate snippet with placeholders including types for single column', () => {
      const columns = [{ name: 'id', type: 'int' }];
      const result = generateRecordEntrySnippet(columns);
      expect(result).toBe('${1:id (int)}');
    });

    it('- should generate snippet with placeholders including types for multiple columns', () => {
      const columns = [
        { name: 'id', type: 'int' },
        { name: 'name', type: 'varchar' },
        { name: 'email', type: 'varchar' },
      ];
      const result = generateRecordEntrySnippet(columns);
      expect(result).toBe('${1:id (int)}, ${2:name (varchar)}, ${3:email (varchar)}');
    });

    it('- should generate snippet with correct placeholder indices', () => {
      const columns = [
        { name: 'a', type: 'int' },
        { name: 'b', type: 'int' },
        { name: 'c', type: 'int' },
        { name: 'd', type: 'int' },
        { name: 'e', type: 'int' },
      ];
      const result = generateRecordEntrySnippet(columns);
      expect(result).toBe('${1:a (int)}, ${2:b (int)}, ${3:c (int)}, ${4:d (int)}, ${5:e (int)}');
    });

    it('- should handle column names with special characters', () => {
      const columns = [
        { name: 'column-1', type: 'int' },
        { name: 'column 2', type: 'varchar' },
        { name: 'column.3', type: 'boolean' },
      ];
      const result = generateRecordEntrySnippet(columns);
      expect(result).toBe('${1:column-1 (int)}, ${2:column 2 (varchar)}, ${3:column.3 (boolean)}');
    });

    it('- should return empty string for empty columns array', () => {
      const columns: Array<{ name: string; type: string }> = [];
      const result = generateRecordEntrySnippet(columns);
      expect(result).toBe('');
    });

    it('- should handle many columns', () => {
      const columns = Array.from({ length: 20 }, (_, i) => ({
        name: `col${i + 1}`,
        type: 'varchar',
      }));
      const result = generateRecordEntrySnippet(columns);

      // Should have 20 placeholders
      const placeholderCount = (result.match(/\$\{/g) || []).length;
      expect(placeholderCount).toBe(20);

      // Should start with ${1:col1 (varchar)}
      expect(result).toMatch(/^\$\{1:col1 \(varchar\)\}/);

      // Should end with ${20:col20 (varchar)}
      expect(result).toMatch(/\$\{20:col20 \(varchar\)\}$/);
    });

    it('- should preserve exact column name and type in placeholder', () => {
      const columns = [
        { name: 'UserId', type: 'int' },
        { name: 'FirstName', type: 'varchar' },
        { name: 'LAST_NAME', type: 'varchar' },
      ];
      const result = generateRecordEntrySnippet(columns);
      expect(result).toBe('${1:UserId (int)}, ${2:FirstName (varchar)}, ${3:LAST_NAME (varchar)}');
    });
  });

  describe('getColumnsFromTableSymbol', () => {
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
        const columns = getColumnsFromTableSymbol(tableSymbol, compiler);

        expect(columns.length).toBe(3);
        expect(columns[0].name).toBe('id');
        expect(columns[0].type).toBe('int');
        expect(columns[1].name).toBe('name');
        expect(columns[1].type).toBe('varchar');
        expect(columns[2].name).toBe('email');
        expect(columns[2].type).toBe('varchar');
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
        const columns = getColumnsFromTableSymbol(tableSymbol, compiler);

        expect(columns.length).toBe(5);
        expect(columns[0].name).toBe('product_id');
        expect(columns[0].type).toBe('int');
        expect(columns[1].name).toBe('product_name');
        expect(columns[1].type).toBe('varchar');
        expect(columns[2].name).toBe('price');
        expect(columns[2].type).toBe('decimal');
        expect(columns[3].name).toBe('in_stock');
        expect(columns[3].type).toBe('boolean');
        expect(columns[4].name).toBe('created_at');
        expect(columns[4].type).toBe('timestamp');
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
        const columns = getColumnsFromTableSymbol(tableSymbol, compiler);

        expect(columns.length).toBe(1);
        expect(columns[0].name).toBe('count');
        expect(columns[0].type).toBe('int');
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
        const columns = getColumnsFromTableSymbol(tableSymbol, compiler);

        expect(columns.length).toBe(3);
        expect(columns[0].name).toBe('column-1');
        expect(columns[0].type).toBe('int');
        expect(columns[1].name).toBe('column 2');
        expect(columns[1].type).toBe('varchar');
        expect(columns[2].name).toBe('column.3');
        expect(columns[2].type).toBe('boolean');
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
        const columns = getColumnsFromTableSymbol(tableSymbol, compiler);
        expect(columns.length).toBe(0);
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
        const columns = getColumnsFromTableSymbol(tableSymbol, compiler);

        // Should only get columns, not indexes
        expect(columns.length).toBe(2);
        expect(columns[0].name).toBe('id');
        expect(columns[0].type).toBe('int');
        expect(columns[1].name).toBe('name');
        expect(columns[1].type).toBe('varchar');
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
        const columns = getColumnsFromTableSymbol(tableSymbol, compiler);

        expect(columns.length).toBe(3);
        expect(columns[0].name).toBe('id');
        expect(columns[0].type).toBe('int');
        expect(columns[1].name).toBe('username');
        expect(columns[1].type).toBe('varchar');
        expect(columns[2].name).toBe('password_hash');
        expect(columns[2].type).toBe('varchar');
      }
    });
  });
});
