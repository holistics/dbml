import { describe, expect } from 'vitest';
import { SyntaxNodeKind, ElementDeclarationNode, BlockExpressionNode } from '@/core/types/nodes';
import { analyze } from '@tests/utils';
import { NodeSymbol, SymbolKind } from '@/core/types';
import { DEFAULT_SCHEMA_NAME } from '@/constants';

describe('[example] binder', () => {
  describe('Table', () => {
    test('should create TableSymbol with correct properties', () => {
      const {
        compiler,
        ast,
      } = analyze('Table users { id int }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableNode = elements[0];
      const tableSymbol = compiler.nodeSymbol(tableNode).getValue() as NodeSymbol;

      // Verify symbol properties
      expect(tableSymbol).toBeInstanceOf(NodeSymbol);
      expect(tableSymbol.kind).toBe(SymbolKind.Table);
      expect(tableSymbol.declaration).toBe(tableNode);
      expect(compiler.symbolReferences(tableSymbol).getValue()).toEqual([]);

      // Verify symbolTable contains column
      const columnSymbol = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue();
      expect(columnSymbol?.kind).toBe(SymbolKind.Column);

      // Verify column symbol properties
      const columnSymbol = findMember(compiler, tableSymbol!, SymbolKind.Column, 'id')!
      const tableBody = tableNode.body as BlockExpressionNode;
      const columnNode = tableBody.body[0];
      expect(columnSymbol?.declaration).toBe(columnNode);
      expect(compiler.symbolReferences(columnSymbol!).getValue()).toEqual([]);

      // Verify public schema symbol table (publicSymbolTable concept)
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue();
      expect(schemaSymbol?.kind).toBe(SymbolKind.Schema);
      const usersTableSymbol = compiler.lookupMembers(schemaSymbol!, SymbolKind.Table, 'users').getValue();
      expect(usersTableSymbol).toBe(tableSymbol);
    });

    test('should verify nested children symbol properties', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar
          email varchar
        }
      `;
      const { ast, compiler } = analyze(source).getValue();
      const tableNode = ast.body[0] as ElementDeclarationNode;
      const tableSymbol = compiler.nodeSymbol(tableNode).getValue() as NodeSymbol;
      const tableBody = tableNode.body as BlockExpressionNode;

      // Verify all columns are in symbolTable
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'name').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'email').getValue()?.kind).toBe(SymbolKind.Column);

      // Verify each column's symbol and declaration relationship
      tableBody.body.forEach((field, index) => {
        const columnNode = field as ElementDeclarationNode;
        const columnSymbol = compiler.nodeSymbol(columnNode).getValue() as NodeSymbol;

        expect(columnSymbol.kind).toBe(SymbolKind.Column);
        expect(columnSymbol.declaration).toBe(columnNode);

        // Verify column is accessible from table's symbolTable
        const expectedNames = ['id', 'name', 'email'];
        expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, expectedNames[index]).getValue()).toBe(columnSymbol);
      });
    });

    test('should allow duplicate column names across tables', () => {
      const source = `
        Table users { id int\n name varchar }
        Table posts { id int\n name varchar }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()?.kind).toBe(SymbolKind.Table);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'posts').getValue()?.kind).toBe(SymbolKind.Table);

      const usersSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue() as NodeSymbol;
      const postsSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'posts').getValue() as NodeSymbol;
      expect(compiler.lookupMembers(usersSymbol, SymbolKind.Column, 'id').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(usersSymbol, SymbolKind.Column, 'name').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(postsSymbol, SymbolKind.Column, 'id').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(postsSymbol, SymbolKind.Column, 'name').getValue()?.kind).toBe(SymbolKind.Column);
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

      const { ast, compiler } = result.getValue();
      const programSymbol = compiler.nodeSymbol(ast).getValue() as NodeSymbol;

      // Root has auth schema and public.users table
      expect(compiler.lookupMembers(programSymbol, SymbolKind.Schema, 'auth').getValue()?.kind).toBe(SymbolKind.Schema);
      expect(compiler.lookupMembers(programSymbol, SymbolKind.Table, 'users').getValue()?.kind).toBe(SymbolKind.Table);

      // auth schema has users table
      const authSchema = compiler.lookupMembers(programSymbol, SymbolKind.Schema, 'auth').getValue() as NodeSymbol;
      expect(compiler.lookupMembers(authSchema, SymbolKind.Table, 'users').getValue()?.kind).toBe(SymbolKind.Table);
    });

    test('should handle table aliases', () => {
      const source = `
        Table users as U {
          id int
          name varchar
        }
        Table posts { user_id int }
        TableGroup g1 { U }
        Ref: posts.user_id > U.id
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const { ast, compiler } = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = compiler.nodeSymbol(elements[0]).getValue() as NodeSymbol;

      const refs = compiler.symbolReferences(usersSymbol).getValue()!;
      expect(refs.length).toBe(2);
      // 1 from TableGroup, 1 from Ref (U.id)
      refs.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(compiler.nodeReferee(refNode).getValue()).toBe(usersSymbol);
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

      const { ast, compiler } = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const employeesSymbol = compiler.nodeSymbol(elements[0]).getValue() as NodeSymbol;

      const refs = compiler.symbolReferences(employeesSymbol).getValue()!;
      expect(refs.length).toBe(1);
      expect(refs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(refs[0]).getValue()).toBe(employeesSymbol);
    });

    test('should handle deeply nested schema names and quoted identifiers', () => {
      const result1 = analyze('Table a.b.c { id int }');
      expect(result1.getErrors()).toHaveLength(0);
      const { ast: ast1, compiler: compiler1 } = result1.getValue();
      const programSymbol1 = compiler1.nodeSymbol(ast1).getValue() as NodeSymbol;
      expect(compiler1.lookupMembers(programSymbol1, SymbolKind.Schema, 'a').getValue()?.kind).toBe(SymbolKind.Schema);

      const result2 = analyze('Table "user-table" { "user-id" int }');
      expect(result2.getErrors()).toHaveLength(0);
      const { ast: ast2, compiler: compiler2 } = result2.getValue();
      const schemaSymbol2 = compiler2.lookupMembers(ast2, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler2.lookupMembers(schemaSymbol2, SymbolKind.Table, 'user-table').getValue()?.kind).toBe(SymbolKind.Table);
    });
  });

  describe('Column', () => {
    test('should create ColumnSymbol with correct properties', () => {
      const source = 'Table users { id int [pk] }';
      const { ast, compiler } = analyze(source).getValue();
      const tableElement = ast.body[0] as ElementDeclarationNode;
      const tableBody = tableElement.body as BlockExpressionNode;
      const columnNode = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = compiler.nodeSymbol(columnNode).getValue() as NodeSymbol;

      expect(columnSymbol.kind).toBe(SymbolKind.Column);
      expect(columnSymbol.declaration).toBe(columnNode);
      expect(compiler.symbolReferences(columnSymbol).getValue()).toEqual([]);

      // Verify column is in table's symbol table
      const tableSymbol = compiler.nodeSymbol(tableElement).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue()).toBe(columnSymbol);
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

      const { ast, compiler } = result.getValue();
      const tableElement = ast.body[0] as ElementDeclarationNode;
      const tableSymbol = compiler.nodeSymbol(tableElement).getValue() as NodeSymbol;

      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'name').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'email').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'status').getValue()?.kind).toBe(SymbolKind.Column);
    });

    test('should track column references from inline refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
      `;
      const { ast, compiler } = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersTable = elements[0];
      const tableBody = usersTable.body as BlockExpressionNode;
      const idColumn = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = compiler.nodeSymbol(idColumn).getValue() as NodeSymbol;

      const refs = compiler.symbolReferences(columnSymbol).getValue()!;
      expect(refs.length).toBe(1);
      expect(refs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(refs[0]).getValue()).toBe(columnSymbol);
    });

    test('should maintain correct reference counts after multiple refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
        Table comments { user_id int [ref: > users.id] }
        Table likes { user_id int [ref: > users.id] }
      `;
      const { ast, compiler } = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersTable = elements[0];
      const usersSymbol = compiler.nodeSymbol(usersTable).getValue() as NodeSymbol;
      const tableBody = usersTable.body as BlockExpressionNode;
      const idColumn = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = compiler.nodeSymbol(idColumn).getValue() as NodeSymbol;

      const usersRefs = compiler.symbolReferences(usersSymbol).getValue()!;
      expect(usersRefs.length).toBe(3);
      usersRefs.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(compiler.nodeReferee(refNode).getValue()).toBe(usersSymbol);
      });

      const colRefs = compiler.symbolReferences(columnSymbol).getValue()!;
      expect(colRefs.length).toBe(3);
      colRefs.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(compiler.nodeReferee(refNode).getValue()).toBe(columnSymbol);
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

      const { ast, compiler } = result.getValue();
      const tableSymbol = compiler.nodeSymbol(ast.body[0] as ElementDeclarationNode).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'email').getValue()?.kind).toBe(SymbolKind.Column);
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

      const { ast, compiler } = result.getValue();
      const tableSymbol = compiler.nodeSymbol(ast.body[0] as ElementDeclarationNode).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'first_name').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'last_name').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'email').getValue()?.kind).toBe(SymbolKind.Column);
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
      const { ast, compiler } = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const enumNode = elements[0];
      const enumSymbol = compiler.nodeSymbol(enumNode).getValue() as NodeSymbol;

      expect(enumSymbol.kind).toBe(SymbolKind.Enum);
      expect(enumSymbol.declaration).toBe(enumNode);
      expect(compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'active').getValue()?.kind).toBe(SymbolKind.EnumField);
      expect(compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'inactive').getValue()?.kind).toBe(SymbolKind.EnumField);
      expect(compiler.symbolReferences(enumSymbol).getValue()).toEqual([]);

      // Verify enum is in public schema symbol table
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'status').getValue()).toBe(enumSymbol);
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

      const { ast, compiler } = result.getValue();
      const enumElement = ast.body[0] as ElementDeclarationNode;
      const enumSymbol = compiler.nodeSymbol(enumElement).getValue() as NodeSymbol;

      expect(compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'pending').getValue()?.kind).toBe(SymbolKind.EnumField);
      expect(compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'approved').getValue()?.kind).toBe(SymbolKind.EnumField);
      expect(compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'rejected').getValue()?.kind).toBe(SymbolKind.EnumField);

      const enumBody = enumElement.body as BlockExpressionNode;
      enumBody.body.forEach((field) => {
        const fieldSymbol = compiler.nodeSymbol(field as ElementDeclarationNode).getValue() as NodeSymbol;
        expect(fieldSymbol.kind).toBe(SymbolKind.EnumField);
        expect(fieldSymbol.declaration).toBe(field);
        expect(compiler.symbolReferences(fieldSymbol).getValue()).toEqual([]);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;

      const enumA = compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'a').getValue() as NodeSymbol;
      const enumB = compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'b').getValue() as NodeSymbol;
      expect(compiler.lookupMembers(enumA, SymbolKind.EnumField, 'val1').getValue()?.kind).toBe(SymbolKind.EnumField);
      expect(compiler.lookupMembers(enumA, SymbolKind.EnumField, 'val2').getValue()?.kind).toBe(SymbolKind.EnumField);
      expect(compiler.lookupMembers(enumB, SymbolKind.EnumField, 'val1').getValue()?.kind).toBe(SymbolKind.EnumField);
      expect(compiler.lookupMembers(enumB, SymbolKind.EnumField, 'val2').getValue()?.kind).toBe(SymbolKind.EnumField);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'status').getValue()?.kind).toBe(SymbolKind.Enum);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()?.kind).toBe(SymbolKind.Table);
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

      const { ast, compiler } = result.getValue();
      const programSymbol = compiler.nodeSymbol(ast).getValue() as NodeSymbol;
      const typesSchema = compiler.lookupMembers(programSymbol, SymbolKind.Schema, 'types').getValue() as NodeSymbol;
      expect(compiler.lookupMembers(typesSchema, SymbolKind.Enum, 'status').getValue()?.kind).toBe(SymbolKind.Enum);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()?.kind).toBe(SymbolKind.Table);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'status_enum').getValue()?.kind).toBe(SymbolKind.Enum);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      const enumSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'order_status').getValue() as NodeSymbol;
      const pendingField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'pending').getValue() as NodeSymbol;

      // Enum should have 2 references: column type + default value
      expect(compiler.symbolReferences(enumSymbol).getValue()!.length).toBe(2);
      // Enum field should have 1 reference from default value
      const pendingRefs = compiler.symbolReferences(pendingField).getValue()!;
      expect(pendingRefs.length).toBe(1);
      expect(compiler.nodeReferee(pendingRefs[0]).getValue()).toBe(pendingField);
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

      const { ast, compiler } = result.getValue();
      const programSymbol = compiler.nodeSymbol(ast).getValue() as NodeSymbol;
      const typesSchema = compiler.lookupMembers(programSymbol, SymbolKind.Schema, 'types').getValue() as NodeSymbol;
      const enumSymbol = compiler.lookupMembers(typesSchema, SymbolKind.Enum, 'status').getValue() as NodeSymbol;
      const activeField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'active').getValue() as NodeSymbol;

      expect(compiler.symbolReferences(enumSymbol).getValue()!.length).toBe(2);
      const activeRefs = compiler.symbolReferences(activeField).getValue()!;
      expect(activeRefs.length).toBe(1);
      expect(compiler.nodeReferee(activeRefs[0]).getValue()).toBe(activeField);
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
      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      const enumSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'true').getValue() as NodeSymbol;
      const valueField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'value').getValue() as NodeSymbol;

      // Enum should have 2 references: column type + default value
      expect(compiler.symbolReferences(enumSymbol).getValue()!.length).toBe(2);
      // Enum field should have 1 reference from default value
      expect(compiler.symbolReferences(valueField).getValue()!.length).toBe(1);
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

      const { ast, compiler } = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = compiler.nodeSymbol(elements[0]).getValue() as NodeSymbol;
      const postsSymbol = compiler.nodeSymbol(elements[1]).getValue() as NodeSymbol;

      const usersRefs = compiler.symbolReferences(usersSymbol).getValue()!;
      expect(usersRefs.length).toBe(1);
      expect(usersRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(usersRefs[0]).getValue()).toBe(usersSymbol);

      const postsRefs = compiler.symbolReferences(postsSymbol).getValue()!;
      expect(postsRefs.length).toBe(1);
      expect(postsRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(postsRefs[0]).getValue()).toBe(postsSymbol);
    });

    test('should bind inline refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const { ast, compiler } = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersTable = elements[0];
      const usersSymbol = compiler.nodeSymbol(usersTable).getValue() as NodeSymbol;
      const tableBody = usersTable.body as BlockExpressionNode;
      const idColumn = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = compiler.nodeSymbol(idColumn).getValue() as NodeSymbol;

      const usersRefs = compiler.symbolReferences(usersSymbol).getValue()!;
      expect(usersRefs.length).toBe(1);
      expect(usersRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(usersRefs[0]).getValue()).toBe(usersSymbol);

      const colRefs = compiler.symbolReferences(columnSymbol).getValue()!;
      expect(colRefs.length).toBe(1);
      expect(colRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(colRefs[0]).getValue()).toBe(columnSymbol);
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
        Table auth.users {
          id int [pk]
          name varchar
        }
        Table public.posts {
          user_id int [ref: > auth.users.id]
          author_name varchar
        }
        Ref: public.posts.author_name > auth.users.name
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const { ast, compiler } = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = compiler.nodeSymbol(elements[0]).getValue() as NodeSymbol;

      const refs = compiler.symbolReferences(usersSymbol).getValue()!;
      expect(refs.length).toBe(2);
      refs.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(compiler.nodeReferee(refNode).getValue()).toBe(usersSymbol);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;

      const usersSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue() as NodeSymbol;
      const postsSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'posts').getValue() as NodeSymbol;

      const usersRefs = compiler.symbolReferences(usersSymbol).getValue()!;
      expect(usersRefs.length).toBe(1);
      expect(usersRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(usersRefs[0]).getValue()).toBe(usersSymbol);

      const postsRefs = compiler.symbolReferences(postsSymbol).getValue()!;
      expect(postsRefs.length).toBe(1);
      expect(postsRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(postsRefs[0]).getValue()).toBe(postsSymbol);
    });

    test('should allow forward reference to table', () => {
      const source = `
        Ref: posts.user_id > users.id
        Table users { id int }
        Table posts { user_id int }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()?.kind).toBe(SymbolKind.Table);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'posts').getValue()?.kind).toBe(SymbolKind.Table);
    });

    test('should track multiple references to the same symbol', () => {
      const source = `
        Table users { id int [pk] }
        Ref r1: users.id < users.id
        Ref r2: users.id < users.id
      `;
      const { ast, compiler } = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = compiler.nodeSymbol(elements[0]).getValue() as NodeSymbol;

      const refs = compiler.symbolReferences(usersSymbol).getValue()!;
      expect(refs.length).toBe(4);
      refs.forEach((refNode) => {
        expect(refNode.kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
        expect(compiler.nodeReferee(refNode).getValue()).toBe(usersSymbol);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      const merchantsSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'merchants').getValue() as NodeSymbol;
      const ordersSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'orders').getValue() as NodeSymbol;

      // Both tables should have 2 references (table name + tuple access)
      expect(compiler.symbolReferences(merchantsSymbol).getValue()!.length).toBe(2);
      expect(compiler.symbolReferences(ordersSymbol).getValue()!.length).toBe(2);

      // Check column references
      const idColumn = compiler.lookupMembers(merchantsSymbol, SymbolKind.Column, 'id').getValue() as NodeSymbol;
      const countryCodeColumn = compiler.lookupMembers(merchantsSymbol, SymbolKind.Column, 'country_code').getValue() as NodeSymbol;
      const merchantIdColumn = compiler.lookupMembers(ordersSymbol, SymbolKind.Column, 'merchant_id').getValue() as NodeSymbol;
      const countryColumn = compiler.lookupMembers(ordersSymbol, SymbolKind.Column, 'country').getValue() as NodeSymbol;

      expect(compiler.symbolReferences(idColumn).getValue()!.length).toBe(1);
      expect(compiler.symbolReferences(countryCodeColumn).getValue()!.length).toBe(1);
      expect(compiler.symbolReferences(merchantIdColumn).getValue()!.length).toBe(1);
      expect(compiler.symbolReferences(countryColumn).getValue()!.length).toBe(1);

      // Verify all references have correct referee
      [idColumn, countryCodeColumn, merchantIdColumn, countryColumn].forEach((col) => {
        const colRefs = compiler.symbolReferences(col).getValue()!;
        expect(compiler.nodeReferee(colRefs[0]).getValue()).toBe(col);
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

      const { ast, compiler } = result.getValue();
      const programSymbol = compiler.nodeSymbol(ast).getValue() as NodeSymbol;
      const shopSchema = compiler.lookupMembers(programSymbol, SymbolKind.Schema, 'shop').getValue() as NodeSymbol;
      const productsSymbol = compiler.lookupMembers(shopSchema, SymbolKind.Table, 'products').getValue() as NodeSymbol;
      const ordersSymbol = compiler.lookupMembers(shopSchema, SymbolKind.Table, 'orders').getValue() as NodeSymbol;

      expect(compiler.symbolReferences(productsSymbol).getValue()!.length).toBe(2);
      expect(compiler.symbolReferences(ordersSymbol).getValue()!.length).toBe(2);
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
      const { ast, compiler } = analyze('TablePartial timestamps { created_at timestamp }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const partialNode = elements[0];
      const partialSymbol = compiler.nodeSymbol(partialNode).getValue() as NodeSymbol;

      expect(partialSymbol.kind).toBe(SymbolKind.TablePartial);
      expect(partialSymbol.declaration).toBe(partialNode);
      expect(compiler.lookupMembers(partialSymbol, SymbolKind.Column, 'created_at').getValue()?.kind).toBe(SymbolKind.Column);
      expect(compiler.symbolReferences(partialSymbol).getValue()).toEqual([]);

      // Verify TablePartial is in public schema symbol table
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.TablePartial, 'timestamps').getValue()).toBe(partialSymbol);
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

      const { ast, compiler } = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const partial = elements.find((e) => e.type?.value === 'TablePartial');
      const partialSymbol = compiler.nodeSymbol(partial!).getValue() as NodeSymbol;

      const refs = compiler.symbolReferences(partialSymbol).getValue()!;
      expect(refs.length).toBe(1);
      expect(refs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(refs[0]).getValue()).toBe(partialSymbol);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;

      const timestampsSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.TablePartial, 'timestamps').getValue() as NodeSymbol;
      const auditSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.TablePartial, 'audit').getValue() as NodeSymbol;

      const tsRefs = compiler.symbolReferences(timestampsSymbol).getValue()!;
      expect(tsRefs.length).toBe(1);
      expect(tsRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(tsRefs[0]).getValue()).toBe(timestampsSymbol);

      const auditRefs = compiler.symbolReferences(auditSymbol).getValue()!;
      expect(auditRefs.length).toBe(1);
      expect(auditRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(auditRefs[0]).getValue()).toBe(auditSymbol);
    });

    test('should handle tables with only partial injections', () => {
      const source = `
        TablePartial base { id int }
        Table derived { ~base }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      const baseSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.TablePartial, 'base').getValue() as NodeSymbol;
      const derivedSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'derived').getValue() as NodeSymbol;

      const baseRefs = compiler.symbolReferences(baseSymbol).getValue()!;
      expect(baseRefs.length).toBe(1);
      expect(baseRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(baseRefs[0]).getValue()).toBe(baseSymbol);
      expect(derivedSymbol?.kind).toBe(SymbolKind.Table);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()?.kind).toBe(SymbolKind.Table);
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.TablePartial, 'timestamps').getValue()?.kind).toBe(SymbolKind.TablePartial);
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
          col1 type [ref: > col2]
          col2 type
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      const usersSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue() as NodeSymbol;
      const idColumn = compiler.lookupMembers(usersSymbol, SymbolKind.Column, 'id').getValue() as NodeSymbol;

      // users.id should be referenced from the partial's inline ref
      const idRefs = compiler.symbolReferences(idColumn).getValue()!;
      expect(idRefs.length).toBe(1);
      expect(compiler.nodeReferee(idRefs[0]).getValue()).toBe(idColumn);
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
      const { ast, compiler } = analyze(source).getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableGroup = elements.find((e) => e.type?.value === 'TableGroup');
      const groupSymbol = compiler.nodeSymbol(tableGroup!).getValue() as NodeSymbol;

      expect(groupSymbol.kind).toBe(SymbolKind.TableGroup);
      expect(groupSymbol.declaration).toBe(tableGroup);
      expect(compiler.symbolReferences(groupSymbol).getValue()).toEqual([]);

      // Verify TableGroup is in public schema symbol table
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.TableGroup, 'group1').getValue()).toBe(groupSymbol);
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

      const { ast, compiler } = result.getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const usersSymbol = compiler.nodeSymbol(elements[0]).getValue() as NodeSymbol;
      const postsSymbol = compiler.nodeSymbol(elements[1]).getValue() as NodeSymbol;

      const usersRefs = compiler.symbolReferences(usersSymbol).getValue()!;
      expect(usersRefs.length).toBe(1);
      expect(usersRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(usersRefs[0]).getValue()).toBe(usersSymbol);

      const postsRefs = compiler.symbolReferences(postsSymbol).getValue()!;
      expect(postsRefs.length).toBe(1);
      expect(postsRefs[0].kind).toBe(SyntaxNodeKind.PRIMARY_EXPRESSION);
      expect(compiler.nodeReferee(postsRefs[0]).getValue()).toBe(postsSymbol);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue() as NodeSymbol;
      expect(compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()?.kind).toBe(SymbolKind.Table);
    });
  });
});
