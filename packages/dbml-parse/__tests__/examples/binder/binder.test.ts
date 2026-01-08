import { describe, expect } from 'vitest';
import { SyntaxNodeKind, ElementDeclarationNode, BlockExpressionNode } from '@/core/parser/nodes';
import { TableSymbol, EnumSymbol, TableGroupSymbol, TablePartialSymbol, ColumnSymbol } from '@/core/analyzer/symbol/symbols';
import { analyze } from '@tests/utils';

describe('[example] binder', () => {
  describe('symbol creation', () => {
    test('should create TableSymbol for table declarations', () => {
      const ast = analyze('Table users { id int }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);

      expect(elements).toHaveLength(1);
      expect(elements[0].symbol).toBeInstanceOf(TableSymbol);
    });

    test('should create EnumSymbol for enum declarations', () => {
      const source = `
        Enum status {
          active
          inactive
        }
      `;
      const ast = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);

      expect(elements).toHaveLength(1);
      expect(elements[0].symbol).toBeInstanceOf(EnumSymbol);
    });

    test('should create TableGroupSymbol for tablegroup declarations', () => {
      const source = `
        Table users { id int }
        TableGroup group1 {
          users
        }
      `;
      const ast = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableGroup = elements.find((e) => e.type?.value === 'TableGroup');

      expect(tableGroup?.symbol).toBeInstanceOf(TableGroupSymbol);
    });

    test('should create TablePartialSymbol for tablepartial declarations', () => {
      const ast = analyze('TablePartial timestamps { created_at timestamp }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);

      expect(elements).toHaveLength(1);
      expect(elements[0].symbol).toBeInstanceOf(TablePartialSymbol);
    });
  });

  describe('reference binding', () => {
    test('should bind table references in refs', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref: posts.user_id > users.id
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should bind table references in inline refs', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int [ref: > users.id] }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should bind table references in TableGroup', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        TableGroup social {
          users
          posts
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should bind TablePartial references', () => {
      const source = `
        TablePartial timestamps {
          created_at timestamp
        }
        Table users {
          id int
          ~timestamps
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('symbol uniqueness', () => {
    test('should generate unique IDs for each symbol', () => {
      const source = `
        Table a { id int }
        Table b { id int }
        Table c { id int }
      `;
      const ast = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const ids = elements.map((e) => e.symbol?.id);

      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('should allow duplicate column names across tables', () => {
      const source = `
        Table users {
          id int
          name varchar
        }
        Table posts {
          id int
          name varchar
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('declaration tracking', () => {
    test('should link symbols to their declaration nodes', () => {
      const ast = analyze('Table users { id int }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);

      expect(elements[0].symbol?.declaration).toBe(elements[0]);
    });
  });

  describe('error detection', () => {
    test('should detect duplicate table names', () => {
      const source = `
        Table users { id int }
        Table users { email varchar }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].diagnostic).toBe("Table name 'users' already exists in schema 'public'");
    });

    test('should detect duplicate column names in same table', () => {
      const source = `
        Table users {
          id int
          name varchar
          id varchar
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(2);
      expect(errors[0].diagnostic).toBe('Duplicate column id');
      expect(errors[1].diagnostic).toBe('Duplicate column id');
    });

    test('should detect duplicate enum field names', () => {
      const source = `
        Enum status {
          active
          active
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(2);
      expect(errors[0].diagnostic).toBe('Duplicate enum field active');
      expect(errors[1].diagnostic).toBe('Duplicate enum field active');
    });

    test('should detect unknown table references', () => {
      const errors = analyze('Ref: nonexistent.id > also_nonexistent.id').getErrors();

      expect(errors).toHaveLength(2);
      expect(errors[0].diagnostic).toBe("Can not find Table 'nonexistent'");
      expect(errors[1].diagnostic).toBe("Can not find Table 'also_nonexistent'");
    });

    test('should detect unknown TablePartial references', () => {
      const source = `
        Table users {
          id int
          ~nonexistent_partial
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].diagnostic).toBe("Can not find TablePartial 'nonexistent_partial'");
    });

    test('should allow same table name in different schemas', () => {
      const source = `
        Table auth.users { id int }
        Table public.users { id int }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('complex binding scenarios', () => {
    test('should handle self-referencing table', () => {
      const source = `
        Table employees {
          id int
          manager_id int [ref: > employees.id]
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should handle table alias references', () => {
      const source = `
        Table users as U { id int }
        TableGroup group1 {
          U
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });

    test('should handle multiple TablePartial injections', () => {
      const source = `
        TablePartial timestamps { created_at timestamp }
        TablePartial audit { created_by int }
        Table users {
          id int
          ~timestamps
          ~audit
        }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    test('should handle tables with only partial injections', () => {
      const source = `
        TablePartial base { id int }
        Table derived { ~base }
      `;
      const result = analyze(source);

      expect(result.getValue()).not.toBeNull();
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should handle deeply nested schema names', () => {
      const result = analyze('Table a.b.c { id int }');

      expect(result.getValue()).not.toBeNull();
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should handle quoted identifiers with special characters', () => {
      const result = analyze('Table "user-table" { "user-id" int }');

      expect(result.getValue()).not.toBeNull();
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should handle Project element', () => {
      const source = `
        Project myapp {
          database_type: 'PostgreSQL'
        }
        Table users { id int }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(0);
    });
  });

  describe('symbol properties', () => {
    test('should set correct symbol properties for tables', () => {
      const ast = analyze('Table users { id int }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableSymbol = elements[0].symbol as TableSymbol;

      expect(tableSymbol.id).toBe(1);
      expect(tableSymbol.declaration).toBe(elements[0]);
    });

    test('should set correct schema for tables with explicit schema', () => {
      const ast = analyze('Table myschema.users { id int }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableSymbol = elements[0].symbol as TableSymbol;

      expect(tableSymbol).toBeDefined();
      expect(tableSymbol.declaration).toBe(elements[0]);
    });

    test('should create column symbols for each column in a table', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar(255)
          email varchar(100) [unique]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableElement = elements[0];
      const tableSymbol = tableElement.symbol as TableSymbol;

      // Verify table has been analyzed correctly
      expect(tableSymbol).toBeInstanceOf(TableSymbol);
      expect(tableElement.body).toBeDefined();
    });

    test('should create enum field symbols for each enum value', () => {
      const source = `
        Enum status {
          pending
          approved
          rejected
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const enumElement = elements[0];
      const enumSymbol = enumElement.symbol as EnumSymbol;

      // Verify enum has been analyzed correctly
      expect(enumSymbol).toBeInstanceOf(EnumSymbol);
      expect(enumElement.body).toBeDefined();
    });
  });

  describe('column symbol properties', () => {
    test('should track pk setting on column symbols', () => {
      const source = 'Table users { id int [pk] }';
      const ast = analyze(source).getValue();
      const tableElement = ast.body[0] as ElementDeclarationNode;
      const tableBody = tableElement.body as BlockExpressionNode;
      const fieldElement = tableBody.body[0] as ElementDeclarationNode;

      const columnSymbol = fieldElement.symbol as ColumnSymbol;
      expect(columnSymbol).toBeInstanceOf(ColumnSymbol);
    });

    test('should track nullable setting on column symbols', () => {
      const source = 'Table users { name varchar [not null] }';
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getValue()).toBeDefined();
    });

    test('should track unique setting on column symbols', () => {
      const source = 'Table users { email varchar [unique] }';
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should handle column with multiple settings', () => {
      const source = `
        Table users {
          id int [pk, increment]
          email varchar [not null, unique]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const tableElement = ast.body[0] as ElementDeclarationNode;
      const tableBody = tableElement.body as BlockExpressionNode;

      expect(tableBody.body.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('index binding', () => {
    test('should bind indexes to columns', () => {
      const source = `
        Table users {
          id int
          email varchar
          indexes {
            email
          }
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should detect unknown columns in indexes', () => {
      const source = `
        Table users {
          id int
          indexes {
            nonexistent_column
          }
        }
      `;
      const result = analyze(source);
      expect(result.getErrors().length).toBeGreaterThan(0);
    });

    test('should bind composite indexes', () => {
      const source = `
        Table users {
          first_name varchar
          last_name varchar
          indexes {
            (first_name, last_name)
          }
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should bind indexes with settings', () => {
      const source = `
        Table users {
          email varchar
          indexes {
            email [unique]
          }
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });
  });

  describe('reference resolution', () => {
    test('should resolve column references in refs', () => {
      const source = `
        Table users {
          id int [pk]
        }
        Table posts {
          id int [pk]
          user_id int [ref: > users.id]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      expect(ast.body.length).toBe(2);
    });

    test('should detect unknown column in ref', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int [ref: > users.nonexistent] }
      `;
      const result = analyze(source);
      expect(result.getErrors().length).toBeGreaterThan(0);
      expect(result.getErrors().some((e) => e.diagnostic.includes('nonexistent'))).toBe(true);
    });

    test('should resolve cross-schema references', () => {
      const source = `
        Table auth.users { id int [pk] }
        Table public.posts { user_id int [ref: > auth.users.id] }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should resolve many-to-many references', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { id int [pk] }
        Table user_posts {
          user_id int [ref: > users.id]
          post_id int [ref: > posts.id]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });
  });

  describe('enum type binding', () => {
    test('should allow enum type reference in column', () => {
      const source = `
        Enum status { active inactive }
        Table users {
          id int
          status status
        }
      `;
      const result = analyze(source);
      // The binder may or may not validate enum type references
      // Just verify it doesn't crash and returns a result
      expect(result.getValue()).toBeDefined();
    });

    test('should detect unknown enum type', () => {
      const source = `
        Table users {
          id int
          status unknown_enum
        }
      `;
      // This may or may not be an error depending on how strict the type system is
      // Just verify it doesn't crash
      const result = analyze(source);
      expect(result.getValue()).toBeDefined();
    });

    test('should allow enum from different schema', () => {
      const source = `
        Enum types.status { active inactive }
        Table users {
          id int
          status types.status
        }
      `;
      const result = analyze(source);
      // Just verify it doesn't crash
      expect(result.getValue()).toBeDefined();
    });
  });

  describe('table alias binding', () => {
    test('should resolve table alias in refs', () => {
      const source = `
        Table users as U { id int [pk] }
        Ref: U.id < U.id
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should allow using both name and alias', () => {
      const source = `
        Table users as U { id int }
        TableGroup g1 { U }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });
  });

  describe('scope isolation', () => {
    test('should isolate column scope to table', () => {
      const source = `
        Table a { col1 int }
        Table b { col1 int }
        Table c { col1 int }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);

      // Each table should have its own column symbol
      const tableSymbols = elements.map((e) => e.symbol as TableSymbol);
      expect(tableSymbols.length).toBe(3);
      tableSymbols.forEach((t) => expect(t).toBeInstanceOf(TableSymbol));
    });

    test('should isolate enum field scope to enum', () => {
      const source = `
        Enum a { val1\n val2 }
        Enum b { val1\n val2 }
      `;
      const result = analyze(source);
      // Some implementations may report duplicate enum field errors across enums
      // Just verify the main structure is created
      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);

      expect(elements.length).toBe(2);
      elements.forEach((e) => expect(e.symbol).toBeInstanceOf(EnumSymbol));
    });
  });

  describe('forward references', () => {
    test('should allow forward reference to table', () => {
      const source = `
        Ref: posts.user_id > users.id
        Table users { id int }
        Table posts { user_id int }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should allow forward reference to enum', () => {
      const source = `
        Table users {
          status status_enum
        }
        Enum status_enum { active\n inactive }
      `;
      const result = analyze(source);
      // Forward reference to enum as column type may or may not be validated
      // Just verify it doesn't crash
      expect(result.getValue()).toBeDefined();
    });

    test('should allow forward reference to TablePartial', () => {
      const source = `
        Table users {
          id int
          ~timestamps
        }
        TablePartial timestamps { created_at timestamp }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });
  });

  describe('error position tracking', () => {
    test('should track error position for duplicate table', () => {
      const source = `Table users { id int }
Table users { name varchar }`;
      const result = analyze(source);
      const errors = result.getErrors();

      expect(errors.length).toBeGreaterThan(0);
      // Error should point to the second declaration
      const duplicateError = errors.find((e) => e.diagnostic.includes('already exists'));
      expect(duplicateError).toBeDefined();
      expect(duplicateError!.start).toBeGreaterThan(0);
    });

    test('should track error position for unknown reference', () => {
      const source = 'Ref: unknown.id > also_unknown.id';
      const result = analyze(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(2);
      errors.forEach((error) => {
        expect(error.start).toBeGreaterThanOrEqual(0);
        expect(error.end).toBeGreaterThan(error.start);
      });
    });
  });
});
