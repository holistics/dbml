import { describe, expect } from 'vitest';
import { SyntaxNodeKind, ElementDeclarationNode, BlockExpressionNode } from '@/core/parser/nodes';
import { TableSymbol, EnumSymbol, TableGroupSymbol, TablePartialSymbol, ColumnSymbol, EnumFieldSymbol, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import { analyze } from '@tests/utils';

describe('[example] binder', () => {
  describe('Table', () => {
    test('should create TableSymbol with correct properties', () => {
      const ast = analyze('Table users { id int }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableSymbol = elements[0].symbol as TableSymbol;

      expect(tableSymbol).toBeInstanceOf(TableSymbol);
      expect(tableSymbol.declaration).toBe(elements[0]);
      expect(tableSymbol.symbolTable.get('Column:id')).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.references).toEqual([]);

      // Verify public schema symbol table
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('Table:users')).toBe(tableSymbol);
    });

    test('should allow duplicate column names across tables', () => {
      const source = `
        Table users { id int\n name varchar }
        Table posts { id int\n name varchar }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('Table:users')).toBeInstanceOf(TableSymbol);
      expect(schemaSymbol.symbolTable.get('Table:posts')).toBeInstanceOf(TableSymbol);

      const usersSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;
      const postsSymbol = schemaSymbol.symbolTable.get('Table:posts') as TableSymbol;
      expect(usersSymbol.symbolTable.get('Column:id')).toBeInstanceOf(ColumnSymbol);
      expect(usersSymbol.symbolTable.get('Column:name')).toBeInstanceOf(ColumnSymbol);
      expect(postsSymbol.symbolTable.get('Column:id')).toBeInstanceOf(ColumnSymbol);
      expect(postsSymbol.symbolTable.get('Column:name')).toBeInstanceOf(ColumnSymbol);
    });

    test('should detect duplicate table names within same schema', () => {
      const source = `
        Table users { id int }
        Table users { email varchar }
      `;
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].diagnostic).toBe("Table name 'users' already exists in schema 'public'");
    });

    test('should allow same table name in different schemas', () => {
      const source = `
        Table auth.users { id int }
        Table public.users { id int }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;

      // Root has auth schema and public.users table
      expect(schemaSymbol.symbolTable.get('Schema:auth')).toBeInstanceOf(SchemaSymbol);
      expect(schemaSymbol.symbolTable.get('Table:users')).toBeInstanceOf(TableSymbol);

      // auth schema has users table
      const authSchema = schemaSymbol.symbolTable.get('Schema:auth') as SchemaSymbol;
      expect(authSchema.symbolTable.get('Table:users')).toBeInstanceOf(TableSymbol);
    });

    test('should handle table aliases', () => {
      const source = `
        Table users as U { id int }
        TableGroup g1 { U }
        Ref: U.id < U.id
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = elements[0].symbol as TableSymbol;

      expect(usersSymbol.references.length).toBe(3);
      // 1 from TableGroup, 2 from Ref (U.id appears twice)
      usersSymbol.references.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(refNode.referee).toBe(usersSymbol);
      });
    });

    test('should handle self-referencing table', () => {
      const source = `
        Table employees {
          id int
          manager_id int [ref: > employees.id]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const employeesSymbol = elements[0].symbol as TableSymbol;

      expect(employeesSymbol.references.length).toBe(1);
      expect(employeesSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(employeesSymbol.references[0].referee).toBe(employeesSymbol);
    });

    test('should handle deeply nested schema names and quoted identifiers', () => {
      const result1 = analyze('Table a.b.c { id int }');
      expect(result1.getErrors()).toHaveLength(0);
      const schemaSymbol1 = result1.getValue().symbol as SchemaSymbol;
      expect(schemaSymbol1.symbolTable.get('Schema:a')).toBeInstanceOf(SchemaSymbol);

      const result2 = analyze('Table "user-table" { "user-id" int }');
      expect(result2.getErrors()).toHaveLength(0);
      const schemaSymbol2 = result2.getValue().symbol as SchemaSymbol;
      expect(schemaSymbol2.symbolTable.get('Table:user-table')).toBeInstanceOf(TableSymbol);
    });
  });

  describe('Column', () => {
    test('should create ColumnSymbol with correct properties', () => {
      const source = 'Table users { id int [pk] }';
      const ast = analyze(source).getValue();
      const tableElement = ast.body[0] as ElementDeclarationNode;
      const tableBody = tableElement.body as BlockExpressionNode;
      const columnNode = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = columnNode.symbol as ColumnSymbol;

      expect(columnSymbol).toBeInstanceOf(ColumnSymbol);
      expect(columnSymbol.declaration).toBe(columnNode);
      expect(columnSymbol.references).toEqual([]);

      // Verify column is in table's symbol table
      const tableSymbol = tableElement.symbol as TableSymbol;
      expect(tableSymbol.symbolTable.get('Column:id')).toBe(columnSymbol);
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

    test('should handle column settings (pk, not null, unique, increment)', () => {
      const source = `
        Table users {
          id int [pk, increment]
          name varchar [not null]
          email varchar [unique]
          status varchar [not null, unique]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const tableElement = ast.body[0] as ElementDeclarationNode;
      const tableSymbol = tableElement.symbol as TableSymbol;

      expect(tableSymbol.symbolTable.get('Column:id')).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get('Column:name')).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get('Column:email')).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get('Column:status')).toBeInstanceOf(ColumnSymbol);
    });

    test('should track column references from inline refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
      `;
      const ast = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersTable = elements[0];
      const tableBody = usersTable.body as BlockExpressionNode;
      const idColumn = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = idColumn.symbol as ColumnSymbol;

      expect(columnSymbol.references.length).toBe(1);
      expect(columnSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(columnSymbol.references[0].referee).toBe(columnSymbol);
    });

    test('should maintain correct reference counts after multiple refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
        Table comments { user_id int [ref: > users.id] }
        Table likes { user_id int [ref: > users.id] }
      `;
      const ast = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersTable = elements[0];
      const usersSymbol = usersTable.symbol as TableSymbol;
      const tableBody = usersTable.body as BlockExpressionNode;
      const idColumn = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = idColumn.symbol as ColumnSymbol;

      expect(usersSymbol.references.length).toBe(3);
      usersSymbol.references.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(refNode.referee).toBe(usersSymbol);
      });

      expect(columnSymbol.references.length).toBe(3);
      columnSymbol.references.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(refNode.referee).toBe(columnSymbol);
      });
    });
  });

  describe('Index', () => {
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

      const ast = result.getValue();
      const tableSymbol = (ast.body[0] as ElementDeclarationNode).symbol as TableSymbol;
      expect(tableSymbol.symbolTable.get('Column:id')).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get('Column:email')).toBeInstanceOf(ColumnSymbol);
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
      const errors = analyze(source).getErrors();

      expect(errors).toHaveLength(1);
      expect(errors[0].diagnostic).toBe("No column named 'nonexistent_column' inside Table 'users'");
    });

    test('should bind composite indexes with settings', () => {
      const source = `
        Table users {
          first_name varchar
          last_name varchar
          email varchar
          indexes {
            (first_name, last_name)
            email [unique]
          }
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const tableSymbol = (ast.body[0] as ElementDeclarationNode).symbol as TableSymbol;
      expect(tableSymbol.symbolTable.get('Column:first_name')).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get('Column:last_name')).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get('Column:email')).toBeInstanceOf(ColumnSymbol);
    });
  });

  describe('Enum', () => {
    test('should create EnumSymbol with correct properties', () => {
      const source = `
        Enum status {
          active
          inactive
        }
      `;
      const ast = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const enumNode = elements[0];
      const enumSymbol = enumNode.symbol as EnumSymbol;

      expect(enumSymbol).toBeInstanceOf(EnumSymbol);
      expect(enumSymbol.declaration).toBe(enumNode);
      expect(enumSymbol.symbolTable.get('Enum field:active')).toBeInstanceOf(EnumFieldSymbol);
      expect(enumSymbol.symbolTable.get('Enum field:inactive')).toBeInstanceOf(EnumFieldSymbol);
      expect(enumSymbol.references).toEqual([]);

      // Verify enum is in public schema symbol table
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('Enum:status')).toBe(enumSymbol);
    });

    test('should create EnumFieldSymbol with correct properties', () => {
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
      const enumElement = ast.body[0] as ElementDeclarationNode;
      const enumSymbol = enumElement.symbol as EnumSymbol;

      expect(enumSymbol.symbolTable.get('Enum field:pending')).toBeInstanceOf(EnumFieldSymbol);
      expect(enumSymbol.symbolTable.get('Enum field:approved')).toBeInstanceOf(EnumFieldSymbol);
      expect(enumSymbol.symbolTable.get('Enum field:rejected')).toBeInstanceOf(EnumFieldSymbol);

      const enumBody = enumElement.body as BlockExpressionNode;
      enumBody.body.forEach((field) => {
        const fieldSymbol = (field as ElementDeclarationNode).symbol as EnumFieldSymbol;
        expect(fieldSymbol).toBeInstanceOf(EnumFieldSymbol);
        expect(fieldSymbol.declaration).toBe(field);
        expect(fieldSymbol.references).toEqual([]);
      });
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

    test('should isolate enum field scope to enum', () => {
      const source = `
        Enum a { val1\n val2 }
        Enum b { val1\n val2 }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;

      const enumA = schemaSymbol.symbolTable.get('Enum:a') as EnumSymbol;
      const enumB = schemaSymbol.symbolTable.get('Enum:b') as EnumSymbol;
      expect(enumA.symbolTable.get('Enum field:val1')).toBeInstanceOf(EnumFieldSymbol);
      expect(enumA.symbolTable.get('Enum field:val2')).toBeInstanceOf(EnumFieldSymbol);
      expect(enumB.symbolTable.get('Enum field:val1')).toBeInstanceOf(EnumFieldSymbol);
      expect(enumB.symbolTable.get('Enum field:val2')).toBeInstanceOf(EnumFieldSymbol);
    });

    test('should allow enum type reference in column', () => {
      const source = `
        Enum status {
          active
          inactive
        }
        Table users {
          id int
          status status
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('Enum:status')).toBeInstanceOf(EnumSymbol);
      expect(schemaSymbol.symbolTable.get('Table:users')).toBeInstanceOf(TableSymbol);
    });

    test('should allow enum from different schema', () => {
      const source = `
        Enum types.status {
          active
          inactive
        }
        Table users {
          id int
          status types.status
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      const typesSchema = schemaSymbol.symbolTable.get('Schema:types') as SchemaSymbol;
      expect(typesSchema.symbolTable.get('Enum:status')).toBeInstanceOf(EnumSymbol);
    });

    test('should allow forward reference to enum', () => {
      const source = `
        Table users {
          status status_enum
        }
        Enum status_enum { active\n inactive }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('Table:users')).toBeInstanceOf(TableSymbol);
      expect(schemaSymbol.symbolTable.get('Enum:status_enum')).toBeInstanceOf(EnumSymbol);
    });

    test('should bind enum field references in default values', () => {
      const source = `
        Enum order_status {
          pending
          processing
          completed
        }
        Table orders {
          id int pk
          status order_status [default: order_status.pending]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      const enumSymbol = schemaSymbol.symbolTable.get('Enum:order_status') as EnumSymbol;
      const pendingField = enumSymbol.symbolTable.get('Enum field:pending') as EnumFieldSymbol;

      // Enum should have 2 references: column type + default value
      expect(enumSymbol.references.length).toBe(2);
      // Enum field should have 1 reference from default value
      expect(pendingField.references.length).toBe(1);
      expect(pendingField.references[0].referee).toBe(pendingField);
    });

    test('should bind schema-qualified enum field references in default values', () => {
      const source = `
        Enum types.status {
          active
          inactive
        }
        Table users {
          status types.status [default: types.status.active]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const publicSchema = ast.symbol as SchemaSymbol;
      const typesSchema = publicSchema.symbolTable.get('Schema:types') as SchemaSymbol;
      const enumSymbol = typesSchema.symbolTable.get('Enum:status') as EnumSymbol;
      const activeField = enumSymbol.symbolTable.get('Enum field:active') as EnumFieldSymbol;

      expect(enumSymbol.references.length).toBe(2);
      expect(activeField.references.length).toBe(1);
      expect(activeField.references[0].referee).toBe(activeField);
    });

    test('should detect invalid enum field in default value', () => {
      const source = `
        Enum status { active\n inactive }
        Table users {
          status status [default: status.nonexistent]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("Enum field 'nonexistent' does not exist in Enum 'status'");
    });

    test('should detect invalid enum in default value', () => {
      const source = `
        Table users {
          status varchar [default: nonexistent_enum.value]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("Enum 'nonexistent_enum' does not exist in Schema 'public'");
    });
  });

  describe('Ref', () => {
    test('should bind table and column references', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref: posts.user_id > users.id
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = elements[0].symbol as TableSymbol;
      const postsSymbol = elements[1].symbol as TableSymbol;

      expect(usersSymbol.references.length).toBe(1);
      expect(usersSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(usersSymbol.references[0].referee).toBe(usersSymbol);

      expect(postsSymbol.references.length).toBe(1);
      expect(postsSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(postsSymbol.references[0].referee).toBe(postsSymbol);
    });

    test('should bind inline refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersTable = elements[0];
      const usersSymbol = usersTable.symbol as TableSymbol;
      const tableBody = usersTable.body as BlockExpressionNode;
      const idColumn = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = idColumn.symbol as ColumnSymbol;

      expect(usersSymbol.references.length).toBe(1);
      expect(usersSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(usersSymbol.references[0].referee).toBe(usersSymbol);

      expect(columnSymbol.references.length).toBe(1);
      expect(columnSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(columnSymbol.references[0].referee).toBe(columnSymbol);
    });

    test('should detect unknown table and column references', () => {
      const errors1 = analyze('Ref: nonexistent.id > also_nonexistent.id').getErrors();
      expect(errors1).toHaveLength(2);
      expect(errors1[0].diagnostic).toBe("Table 'nonexistent' does not exist in Schema 'public'");
      expect(errors1[1].diagnostic).toBe("Table 'also_nonexistent' does not exist in Schema 'public'");

      const source2 = `
        Table users { id int }
        Table posts { user_id int [ref: > users.nonexistent] }
      `;
      const errors2 = analyze(source2).getErrors();
      expect(errors2).toHaveLength(1);
      expect(errors2[0].diagnostic).toBe("Column 'nonexistent' does not exist in Table 'users'");
    });

    test('should resolve cross-schema references', () => {
      const source = `
        Table auth.users { id int [pk] }
        Table public.posts { user_id int [ref: > auth.users.id] }
        Ref: auth.users.id < auth.users.id
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = elements[0].symbol as TableSymbol;

      expect(usersSymbol.references.length).toBe(3);
      usersSymbol.references.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(refNode.referee).toBe(usersSymbol);
      });
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

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;

      const usersSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;
      const postsSymbol = schemaSymbol.symbolTable.get('Table:posts') as TableSymbol;

      expect(usersSymbol.references.length).toBe(1);
      expect(usersSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(usersSymbol.references[0].referee).toBe(usersSymbol);

      expect(postsSymbol.references.length).toBe(1);
      expect(postsSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(postsSymbol.references[0].referee).toBe(postsSymbol);
    });

    test('should allow forward reference to table', () => {
      const source = `
        Ref: posts.user_id > users.id
        Table users { id int }
        Table posts { user_id int }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('Table:users')).toBeInstanceOf(TableSymbol);
      expect(schemaSymbol.symbolTable.get('Table:posts')).toBeInstanceOf(TableSymbol);
    });

    test('should track multiple references to the same symbol', () => {
      const source = `
        Table users { id int [pk] }
        Ref r1: users.id < users.id
        Ref r2: users.id < users.id
      `;
      const ast = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = elements[0].symbol as TableSymbol;

      expect(usersSymbol.references.length).toBe(4);
      usersSymbol.references.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(refNode.referee).toBe(usersSymbol);
      });
    });

    test('should bind composite foreign key references', () => {
      const source = `
        Table merchants {
          id int pk
          country_code varchar
        }
        Table orders {
          merchant_id int
          country varchar
        }
        Ref: orders.(merchant_id, country) > merchants.(id, country_code)
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      const merchantsSymbol = schemaSymbol.symbolTable.get('Table:merchants') as TableSymbol;
      const ordersSymbol = schemaSymbol.symbolTable.get('Table:orders') as TableSymbol;

      // Both tables should have 2 references (table name + tuple access)
      expect(merchantsSymbol.references.length).toBe(2);
      expect(ordersSymbol.references.length).toBe(2);

      // Check column references
      const idColumn = merchantsSymbol.symbolTable.get('Column:id') as ColumnSymbol;
      const countryCodeColumn = merchantsSymbol.symbolTable.get('Column:country_code') as ColumnSymbol;
      const merchantIdColumn = ordersSymbol.symbolTable.get('Column:merchant_id') as ColumnSymbol;
      const countryColumn = ordersSymbol.symbolTable.get('Column:country') as ColumnSymbol;

      expect(idColumn.references.length).toBe(1);
      expect(countryCodeColumn.references.length).toBe(1);
      expect(merchantIdColumn.references.length).toBe(1);
      expect(countryColumn.references.length).toBe(1);

      // Verify all references have correct referee
      [idColumn, countryCodeColumn, merchantIdColumn, countryColumn].forEach((col) => {
        expect(col.references[0].referee).toBe(col);
      });
    });

    test('should bind composite foreign key with schema-qualified names', () => {
      const source = `
        Table shop.products {
          id int pk
          category_id int
        }
        Table shop.orders {
          product_id int
          category int
        }
        Ref: shop.orders.(product_id, category) > shop.products.(id, category_id)
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const publicSchema = ast.symbol as SchemaSymbol;
      const shopSchema = publicSchema.symbolTable.get('Schema:shop') as SchemaSymbol;
      const productsSymbol = shopSchema.symbolTable.get('Table:products') as TableSymbol;
      const ordersSymbol = shopSchema.symbolTable.get('Table:orders') as TableSymbol;

      expect(productsSymbol.references.length).toBe(2);
      expect(ordersSymbol.references.length).toBe(2);
    });

    test('should detect errors in composite foreign key references', () => {
      const source = `
        Table users { id int }
        Table posts { user_id int }
        Ref: posts.(user_id, nonexistent) > users.(id, also_nonexistent)
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(2);
      expect(errors[0].diagnostic).toBe("Column 'nonexistent' does not exist in Table 'posts'");
      expect(errors[1].diagnostic).toBe("Column 'also_nonexistent' does not exist in Table 'users'");
    });
  });

  describe('TablePartial', () => {
    test('should create TablePartialSymbol with correct properties', () => {
      const ast = analyze('TablePartial timestamps { created_at timestamp }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const partialNode = elements[0];
      const partialSymbol = partialNode.symbol as TablePartialSymbol;

      expect(partialSymbol).toBeInstanceOf(TablePartialSymbol);
      expect(partialSymbol.declaration).toBe(partialNode);
      expect(partialSymbol.symbolTable.get('Column:created_at')).toBeInstanceOf(ColumnSymbol);
      expect(partialSymbol.references).toEqual([]);

      // Verify TablePartial is in public schema symbol table
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('TablePartial:timestamps')).toBe(partialSymbol);
    });

    test('should bind TablePartial references and track injections', () => {
      const source = `
        TablePartial timestamps { created_at timestamp }
        Table users {
          id int
          ~timestamps
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const partial = elements.find((e) => e.type?.value === 'TablePartial');
      const partialSymbol = partial?.symbol as TablePartialSymbol;

      expect(partialSymbol.references.length).toBe(1);
      expect(partialSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(partialSymbol.references[0].referee).toBe(partialSymbol);
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
      expect(errors[0].diagnostic).toBe("TablePartial 'nonexistent_partial' does not exist in Schema 'public'");
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
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;

      const timestampsSymbol = schemaSymbol.symbolTable.get('TablePartial:timestamps') as TablePartialSymbol;
      const auditSymbol = schemaSymbol.symbolTable.get('TablePartial:audit') as TablePartialSymbol;

      expect(timestampsSymbol.references.length).toBe(1);
      expect(timestampsSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(timestampsSymbol.references[0].referee).toBe(timestampsSymbol);

      expect(auditSymbol.references.length).toBe(1);
      expect(auditSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(auditSymbol.references[0].referee).toBe(auditSymbol);
    });

    test('should handle tables with only partial injections', () => {
      const source = `
        TablePartial base { id int }
        Table derived { ~base }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      const baseSymbol = schemaSymbol.symbolTable.get('TablePartial:base') as TablePartialSymbol;
      const derivedSymbol = schemaSymbol.symbolTable.get('Table:derived') as TableSymbol;

      expect(baseSymbol.references.length).toBe(1);
      expect(baseSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(baseSymbol.references[0].referee).toBe(baseSymbol);
      expect(derivedSymbol).toBeInstanceOf(TableSymbol);
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

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('Table:users')).toBeInstanceOf(TableSymbol);
      expect(schemaSymbol.symbolTable.get('TablePartial:timestamps')).toBeInstanceOf(TablePartialSymbol);
    });
  });

  describe('TableGroup', () => {
    test('should create TableGroupSymbol with correct properties', () => {
      const source = `
        Table users { id int }
        TableGroup group1 {
          users
        }
      `;
      const ast = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableGroup = elements.find((e) => e.type?.value === 'TableGroup');
      const groupSymbol = tableGroup?.symbol as TableGroupSymbol;

      expect(groupSymbol).toBeInstanceOf(TableGroupSymbol);
      expect(groupSymbol.declaration).toBe(tableGroup);
      expect(groupSymbol.symbolTable).toBeDefined();
      expect(groupSymbol.references).toEqual([]);

      // Verify TableGroup is in public schema symbol table
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('TableGroup:group1')).toBe(groupSymbol);
    });

    test('should bind table references and track them', () => {
      const source = `
        Table users { id int }
        Table posts { id int }
        TableGroup social {
          users
          posts
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = elements[0].symbol as TableSymbol;
      const postsSymbol = elements[1].symbol as TableSymbol;

      expect(usersSymbol.references.length).toBe(1);
      expect(usersSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(usersSymbol.references[0].referee).toBe(usersSymbol);

      expect(postsSymbol.references.length).toBe(1);
      expect(postsSymbol.references[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(postsSymbol.references[0].referee).toBe(postsSymbol);
    });
  });

  describe('Project', () => {
    test('should handle Project element', () => {
      const source = `
        Project myapp {
          database_type: 'PostgreSQL'
        }
        Table users { id int }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get('Table:users')).toBeInstanceOf(TableSymbol);
    });
  });
});
