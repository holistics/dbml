import { describe, expect } from 'vitest';
import { SyntaxNodeKind, ElementDeclarationNode, BlockExpressionNode } from '@/core/parser/nodes';
import { TableSymbol, EnumSymbol, TableGroupSymbol, TablePartialSymbol, ColumnSymbol, EnumFieldSymbol, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import {
  createColumnSymbolIndex,
  createTableSymbolIndex,
  createSchemaSymbolIndex,
  createEnumSymbolIndex,
  createEnumFieldSymbolIndex,
  createTableGroupSymbolIndex,
  createTablePartialSymbolIndex
} from '@/core/analyzer/symbol/symbolIndex';
import { analyze } from '@tests/utils';

describe('[example] binder', () => {
  describe('Table', () => {
    test('should create TableSymbol with correct properties', () => {
      const ast = analyze('Table users { id int }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableNode = elements[0];
      const tableSymbol = tableNode.symbol as TableSymbol;

      // Verify symbol properties
      expect(tableSymbol).toBeInstanceOf(TableSymbol);
      expect(tableSymbol.declaration).toBe(tableNode);
      expect(tableSymbol.references).toEqual([]);

      // Verify symbolTable contains column
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('id'))).toBeInstanceOf(ColumnSymbol);

      // Verify column symbol properties
      const columnSymbol = tableSymbol.symbolTable.get(createColumnSymbolIndex('id')) as ColumnSymbol;
      const tableBody = tableNode.body as BlockExpressionNode;
      const columnNode = tableBody.body[0];
      expect(columnSymbol.declaration).toBe(columnNode);
      expect(columnSymbol.references).toEqual([]);

      // Verify public schema symbol table (publicSymbolTable concept)
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol).toBeInstanceOf(SchemaSymbol);
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('users'))).toBe(tableSymbol);
    });

    test('should verify nested children symbol properties', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar
          email varchar
        }
      `;
      const ast = analyze(source).getValue();
      const tableNode = ast.body[0] as ElementDeclarationNode;
      const tableSymbol = tableNode.symbol as TableSymbol;
      const tableBody = tableNode.body as BlockExpressionNode;

      // Verify all columns are in symbolTable
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('id'))).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('name'))).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('email'))).toBeInstanceOf(ColumnSymbol);

      // Verify each column's symbol and declaration relationship
      tableBody.body.forEach((field, index) => {
        const columnNode = field as ElementDeclarationNode;
        const columnSymbol = columnNode.symbol as ColumnSymbol;

        expect(columnSymbol).toBeInstanceOf(ColumnSymbol);
        expect(columnSymbol.declaration).toBe(columnNode);

        // Verify column is accessible from table's symbolTable
        const expectedNames = ['id', 'name', 'email'];
        expect(tableSymbol.symbolTable.get(createColumnSymbolIndex(expectedNames[index]))).toBe(columnSymbol);
      });
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
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('users'))).toBeInstanceOf(TableSymbol);
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('posts'))).toBeInstanceOf(TableSymbol);

      const usersSymbol = schemaSymbol.symbolTable.get(createTableSymbolIndex('users')) as TableSymbol;
      const postsSymbol = schemaSymbol.symbolTable.get(createTableSymbolIndex('posts')) as TableSymbol;
      expect(usersSymbol.symbolTable.get(createColumnSymbolIndex('id'))).toBeInstanceOf(ColumnSymbol);
      expect(usersSymbol.symbolTable.get(createColumnSymbolIndex('name'))).toBeInstanceOf(ColumnSymbol);
      expect(postsSymbol.symbolTable.get(createColumnSymbolIndex('id'))).toBeInstanceOf(ColumnSymbol);
      expect(postsSymbol.symbolTable.get(createColumnSymbolIndex('name'))).toBeInstanceOf(ColumnSymbol);
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
      expect(schemaSymbol.symbolTable.get(createSchemaSymbolIndex('auth'))).toBeInstanceOf(SchemaSymbol);
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('users'))).toBeInstanceOf(TableSymbol);

      // auth schema has users table
      const authSchema = schemaSymbol.symbolTable.get(createSchemaSymbolIndex('auth')) as SchemaSymbol;
      expect(authSchema.symbolTable.get(createTableSymbolIndex('users'))).toBeInstanceOf(TableSymbol);
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
      expect(schemaSymbol1.symbolTable.get(createSchemaSymbolIndex('a'))).toBeInstanceOf(SchemaSymbol);

      const result2 = analyze('Table "user-table" { "user-id" int }');
      expect(result2.getErrors()).toHaveLength(0);
      const schemaSymbol2 = result2.getValue().symbol as SchemaSymbol;
      expect(schemaSymbol2.symbolTable.get(createTableSymbolIndex('user-table'))).toBeInstanceOf(TableSymbol);
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
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('id'))).toBe(columnSymbol);
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

      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('id'))).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('name'))).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('email'))).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('status'))).toBeInstanceOf(ColumnSymbol);
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
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('id'))).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('email'))).toBeInstanceOf(ColumnSymbol);
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
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('first_name'))).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('last_name'))).toBeInstanceOf(ColumnSymbol);
      expect(tableSymbol.symbolTable.get(createColumnSymbolIndex('email'))).toBeInstanceOf(ColumnSymbol);
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
      expect(enumSymbol.symbolTable.get(createEnumFieldSymbolIndex('active'))).toBeInstanceOf(EnumFieldSymbol);
      expect(enumSymbol.symbolTable.get(createEnumFieldSymbolIndex('inactive'))).toBeInstanceOf(EnumFieldSymbol);
      expect(enumSymbol.references).toEqual([]);

      // Verify enum is in public schema symbol table
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get(createEnumSymbolIndex('status'))).toBe(enumSymbol);
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

      expect(enumSymbol.symbolTable.get(createEnumFieldSymbolIndex('pending'))).toBeInstanceOf(EnumFieldSymbol);
      expect(enumSymbol.symbolTable.get(createEnumFieldSymbolIndex('approved'))).toBeInstanceOf(EnumFieldSymbol);
      expect(enumSymbol.symbolTable.get(createEnumFieldSymbolIndex('rejected'))).toBeInstanceOf(EnumFieldSymbol);

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

      const enumA = schemaSymbol.symbolTable.get(createEnumSymbolIndex('a')) as EnumSymbol;
      const enumB = schemaSymbol.symbolTable.get(createEnumSymbolIndex('b')) as EnumSymbol;
      expect(enumA.symbolTable.get(createEnumFieldSymbolIndex('val1'))).toBeInstanceOf(EnumFieldSymbol);
      expect(enumA.symbolTable.get(createEnumFieldSymbolIndex('val2'))).toBeInstanceOf(EnumFieldSymbol);
      expect(enumB.symbolTable.get(createEnumFieldSymbolIndex('val1'))).toBeInstanceOf(EnumFieldSymbol);
      expect(enumB.symbolTable.get(createEnumFieldSymbolIndex('val2'))).toBeInstanceOf(EnumFieldSymbol);
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
      expect(schemaSymbol.symbolTable.get(createEnumSymbolIndex('status'))).toBeInstanceOf(EnumSymbol);
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('users'))).toBeInstanceOf(TableSymbol);
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
      const typesSchema = schemaSymbol.symbolTable.get(createSchemaSymbolIndex('types')) as SchemaSymbol;
      expect(typesSchema.symbolTable.get(createEnumSymbolIndex('status'))).toBeInstanceOf(EnumSymbol);
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
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('users'))).toBeInstanceOf(TableSymbol);
      expect(schemaSymbol.symbolTable.get(createEnumSymbolIndex('status_enum'))).toBeInstanceOf(EnumSymbol);
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
      const enumSymbol = schemaSymbol.symbolTable.get(createEnumSymbolIndex('order_status')) as EnumSymbol;
      const pendingField = enumSymbol.symbolTable.get(createEnumFieldSymbolIndex('pending')) as EnumFieldSymbol;

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
      const typesSchema = publicSchema.symbolTable.get(createSchemaSymbolIndex('types')) as SchemaSymbol;
      const enumSymbol = typesSchema.symbolTable.get(createEnumSymbolIndex('status')) as EnumSymbol;
      const activeField = enumSymbol.symbolTable.get(createEnumFieldSymbolIndex('active')) as EnumFieldSymbol;

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

    test('should allow double-quoted string as default value', () => {
      const source = `
        Table users {
          name varchar [default: "hello"]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should allow single-quoted string as default value', () => {
      const source = `
        Table users {
          name varchar [default: \`hello\`]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should allow null keyword as default value', () => {
      const source = `
        Table users {
          name varchar [default: null]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should allow true keyword as default value', () => {
      const source = `
        Table users {
          active boolean [default: true]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should allow false keyword as default value', () => {
      const source = `
        Table users {
          active boolean [default: false]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should bind true.value as enum access', () => {
      // true.value is treated as enum "true" with field "value"
      const source = `
        Table users {
          status varchar [default: true.value]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("Enum 'true' does not exist in Schema 'public'");
    });

    test('should bind true.value when enum true exists but field does not', () => {
      const source = `
        Enum true {
          other
        }
        Table users {
          status true [default: true.value]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("Enum field 'value' does not exist in Enum 'true'");
    });

    test('should bind true.value when enum true exists with field value', () => {
      const source = `
        Enum true {
          value
          other
        }
        Table users {
          status true [default: true.value]
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      // Verify the binding
      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      const enumSymbol = schemaSymbol.symbolTable.get(createEnumSymbolIndex('true')) as EnumSymbol;
      const valueField = enumSymbol.symbolTable.get(createEnumFieldSymbolIndex('value')) as EnumFieldSymbol;

      // Enum should have 2 references: column type + default value
      expect(enumSymbol.references.length).toBe(2);
      // Enum field should have 1 reference from default value
      expect(valueField.references.length).toBe(1);
    });

    test('should bind quoted string with field as enum access', () => {
      // "hello".abc is treated as enum "hello" with field "abc"
      const source = `
        Table users {
          status varchar [default: "hello".abc]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("Enum 'hello' does not exist in Schema 'public'");
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

      const usersSymbol = schemaSymbol.symbolTable.get(createTableSymbolIndex('users')) as TableSymbol;
      const postsSymbol = schemaSymbol.symbolTable.get(createTableSymbolIndex('posts')) as TableSymbol;

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
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('users'))).toBeInstanceOf(TableSymbol);
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('posts'))).toBeInstanceOf(TableSymbol);
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
      const merchantsSymbol = schemaSymbol.symbolTable.get(createTableSymbolIndex('merchants')) as TableSymbol;
      const ordersSymbol = schemaSymbol.symbolTable.get(createTableSymbolIndex('orders')) as TableSymbol;

      // Both tables should have 2 references (table name + tuple access)
      expect(merchantsSymbol.references.length).toBe(2);
      expect(ordersSymbol.references.length).toBe(2);

      // Check column references
      const idColumn = merchantsSymbol.symbolTable.get(createColumnSymbolIndex('id')) as ColumnSymbol;
      const countryCodeColumn = merchantsSymbol.symbolTable.get(createColumnSymbolIndex('country_code')) as ColumnSymbol;
      const merchantIdColumn = ordersSymbol.symbolTable.get(createColumnSymbolIndex('merchant_id')) as ColumnSymbol;
      const countryColumn = ordersSymbol.symbolTable.get(createColumnSymbolIndex('country')) as ColumnSymbol;

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
      const shopSchema = publicSchema.symbolTable.get(createSchemaSymbolIndex('shop')) as SchemaSymbol;
      const productsSymbol = shopSchema.symbolTable.get(createTableSymbolIndex('products')) as TableSymbol;
      const ordersSymbol = shopSchema.symbolTable.get(createTableSymbolIndex('orders')) as TableSymbol;

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
      expect(partialSymbol.symbolTable.get(createColumnSymbolIndex('created_at'))).toBeInstanceOf(ColumnSymbol);
      expect(partialSymbol.references).toEqual([]);

      // Verify TablePartial is in public schema symbol table
      const schemaSymbol = ast.symbol as SchemaSymbol;
      expect(schemaSymbol.symbolTable.get(createTablePartialSymbolIndex('timestamps'))).toBe(partialSymbol);
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

      const timestampsSymbol = schemaSymbol.symbolTable.get(createTablePartialSymbolIndex('timestamps')) as TablePartialSymbol;
      const auditSymbol = schemaSymbol.symbolTable.get(createTablePartialSymbolIndex('audit')) as TablePartialSymbol;

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
      const baseSymbol = schemaSymbol.symbolTable.get(createTablePartialSymbolIndex('base')) as TablePartialSymbol;
      const derivedSymbol = schemaSymbol.symbolTable.get(createTableSymbolIndex('derived')) as TableSymbol;

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
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('users'))).toBeInstanceOf(TableSymbol);
      expect(schemaSymbol.symbolTable.get(createTablePartialSymbolIndex('timestamps'))).toBeInstanceOf(TablePartialSymbol);
    });

    test('should detect non-existent TablePartial injection', () => {
      const source = `
        TablePartial p1 {}
        Table t1 {
          id int
          ~p1
          ~p2
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toEqual(1);
      expect(errors[0].diagnostic).toBe("TablePartial 'p2' does not exist in Schema 'public'");
    });

    test('should detect nonexisting inline ref column in table partial', () => {
      const source = `
        TablePartial T1 {
          col1 type [ref: > un_col1]
          col2 type [ref: > T1.un_col2]
          col3 type [ref: > un_T.un_col3]
        }

        Table T1 {
          col type [ref: > un_col]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(4);

      const errorDiagnostics = errors.map((e) => e.diagnostic);
      expect(errorDiagnostics).toContain("Column 'un_col1' does not exist in TablePartial 'T1'");
      expect(errorDiagnostics).toContain("Column 'un_col2' does not exist in Table 'T1'");
      expect(errorDiagnostics).toContain("Table 'un_T' does not exist in Schema 'public'");
      expect(errorDiagnostics).toContain("Column 'un_col' does not exist in Table 'T1'");
    });

    test('should allow self-referential ref in table partial', () => {
      const source = `
        TablePartial T {
          col type [ref: > col]
        }
      `;
      const errors = analyze(source).getErrors();
      // Self-referential refs in table partials are allowed
      expect(errors.length).toBe(0);
    });

    test('should allow circular ref caused by table partial injection', () => {
      const source = `
        TablePartial T {
          col1 type [ref: > T.col1]
          col3 type [ref: > T.col2]
        }

        Table T {
          ~T
          col2 type [ref: > col3]
        }
      `;
      const errors = analyze(source).getErrors();
      // Circular refs via table partials are allowed
      expect(errors.length).toBe(0);
    });

    test('should bind refs in table partial columns when injected', () => {
      const source = `
        TablePartial common {
          user_id int [ref: > users.id]
        }

        Table users {
          id int [pk]
        }

        Table posts {
          id int [pk]
          ~common
        }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const ast = result.getValue();
      const schemaSymbol = ast.symbol as SchemaSymbol;
      const usersSymbol = schemaSymbol.symbolTable.get(createTableSymbolIndex('users')) as TableSymbol;
      const idColumn = usersSymbol.symbolTable.get(createColumnSymbolIndex('id')) as ColumnSymbol;

      // users.id should be referenced from the partial's inline ref
      expect(idColumn.references.length).toBe(1);
      expect(idColumn.references[0].referee).toBe(idColumn);
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
      expect(schemaSymbol.symbolTable.get(createTableGroupSymbolIndex('group1'))).toBe(groupSymbol);
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
      expect(schemaSymbol.symbolTable.get(createTableSymbolIndex('users'))).toBeInstanceOf(TableSymbol);
    });
  });
});
