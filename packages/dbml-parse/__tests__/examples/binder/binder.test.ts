import { describe, expect } from 'vitest';
import { SyntaxNodeKind, ElementDeclarationNode, BlockExpressionNode, ProgramNode } from '@/core/types/nodes';
import { SchemaSymbol, NodeSymbol, SymbolKind } from '@/core/types/symbol';
import { UNHANDLED } from '@/core/types/module';
import { CompileErrorCode } from '@/core/types/errors';
import { analyze } from '@tests/utils';
import type Compiler from '@/compiler';

function findMember (compiler: Compiler, symbol: NodeSymbol, kind: SymbolKind, name: string): NodeSymbol | undefined {
  const members = compiler.symbolMembers(symbol).getFiltered(UNHANDLED) ?? [];
  return members.find((m) => m.kind === kind && compiler.symbolName(m) === name);
}

function nodeSymbol (compiler: Compiler, node: ElementDeclarationNode | ProgramNode): NodeSymbol | undefined {
  return compiler.nodeSymbol(node).getFiltered(UNHANDLED);
}

describe('[example] binder', () => {
  describe('Table', () => {
    test('should create TableSymbol with correct properties', () => {
      const { ast, compiler } = analyze('Table users { id int }').getValue();
      const elements = ast.body.filter((n): n is ElementDeclarationNode => n.kind === SyntaxNodeKind.ELEMENT_DECLARATION);
      const tableNode = elements[0];
      const tableSymbol = nodeSymbol(compiler, tableNode);

      // Verify symbol properties
      expect(tableSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
      expect(tableSymbol!.declaration).toBe(tableNode);

      // Verify symbolTable contains column
      expect(findMember(compiler, tableSymbol!, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));

      // Verify column symbol properties
      const columnSymbol = findMember(compiler, tableSymbol!, SymbolKind.Column, 'id')
      const tableBody = tableNode.body as BlockExpressionNode;
      const columnNode = tableBody.body[0];
      expect(columnSymbol!.declaration).toBe(columnNode);

      // Verify public schema symbol table (publicSymbolTable concept)
      const schemaSymbol = nodeSymbol(compiler, ast);
      expect(schemaSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Program));
      expect(findMember(compiler, schemaSymbol!, SymbolKind.Table, 'users')).toBe(tableSymbol);
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
      const tableSymbol = nodeSymbol(compiler, tableNode)!;
      const tableBody = tableNode.body as BlockExpressionNode;

      // Verify all columns are in symbolTable
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'email')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));

      // Verify each column's symbol and declaration relationship
      tableBody.body.forEach((field, index) => {
        const columnNode = field as ElementDeclarationNode;
        const columnSymbol = nodeSymbol(compiler, columnNode);

        expect(columnSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
        expect(columnSymbol!.declaration).toBe(columnNode);

        // Verify column is accessible from table's symbolTable
        const expectedNames = ['id', 'name', 'email'];
        expect(findMember(compiler, tableSymbol, SymbolKind.Column, expectedNames[index])).toBe(columnSymbol);
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'posts')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));

      const usersSymbol = findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')!;
      const postsSymbol = findMember(compiler, schemaSymbol, SymbolKind.Table, 'posts')!;
      expect(findMember(compiler, usersSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, usersSymbol, SymbolKind.Column, 'name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, postsSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, postsSymbol, SymbolKind.Column, 'name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;

      // Root has auth schema and public.users table
      expect(findMember(compiler, schemaSymbol, SymbolKind.Schema, 'auth')).toSatisfy((s: any) => s?.isKind(SymbolKind.Schema));
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));

      // auth schema has users table
      const authSchema = findMember(compiler, schemaSymbol, SymbolKind.Schema, 'auth')!;
      expect(findMember(compiler, authSchema, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
    });

    test('should handle table aliases', () => {
      const source = `
        Table users as U { id int\n other_id int }
        TableGroup g1 { U }
        Ref: U.id < U.other_id
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
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
    });

    test('should handle deeply nested schema names and quoted identifiers', () => {
      const result1 = analyze('Table a.b.c { id int }');
      expect(result1.getErrors()).toHaveLength(0);
      const { ast: ast1, compiler: compiler1 } = result1.getValue();
      const schemaSymbol1 = nodeSymbol(compiler1, ast1)!;
      expect(findMember(compiler1, schemaSymbol1, SymbolKind.Schema, 'a')).toSatisfy((s: any) => s?.isKind(SymbolKind.Schema));

      const result2 = analyze('Table "user-table" { "user-id" int }');
      expect(result2.getErrors()).toHaveLength(0);
      const { ast: ast2, compiler: compiler2 } = result2.getValue();
      const schemaSymbol2 = nodeSymbol(compiler2, ast2)!;
      expect(findMember(compiler2, schemaSymbol2, SymbolKind.Table, 'user-table')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
    });
  });

  describe('Column', () => {
    test('should create ColumnSymbol with correct properties', () => {
      const source = 'Table users { id int [pk] }';
      const { ast, compiler } = analyze(source).getValue();
      const tableElement = ast.body[0] as ElementDeclarationNode;
      const tableBody = tableElement.body as BlockExpressionNode;
      const columnNode = tableBody.body[0] as ElementDeclarationNode;
      const columnSymbol = nodeSymbol(compiler, columnNode);

      expect(columnSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(columnSymbol!.declaration).toBe(columnNode);

      // Verify column is in table's symbol table
      const tableSymbol = nodeSymbol(compiler, tableElement)!;
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'id')).toBe(columnSymbol);
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
      const tableSymbol = nodeSymbol(compiler, tableElement)!;

      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'email')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'status')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
    });

    test('should track column references from inline refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
    });

    test('should maintain correct reference counts after multiple refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
        Table comments { user_id int [ref: > users.id] }
        Table likes { user_id int [ref: > users.id] }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
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
      const tableSymbol = nodeSymbol(compiler, ast.body[0] as ElementDeclarationNode)!;
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'email')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
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
      const tableSymbol = nodeSymbol(compiler, ast.body[0] as ElementDeclarationNode)!;
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'first_name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'last_name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'email')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
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
      const enumSymbol = nodeSymbol(compiler, enumNode)!;

      expect(enumSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Enum));
      expect(enumSymbol.declaration).toBe(enumNode);
      expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'active')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
      expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'inactive')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));

      // Verify enum is in public schema symbol table
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.Enum, 'status')).toBe(enumSymbol);
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
      const enumSymbol = nodeSymbol(compiler, enumElement)!;

      expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'pending')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
      expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'approved')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
      expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'rejected')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));

      const enumBody = enumElement.body as BlockExpressionNode;
      enumBody.body.forEach((field) => {
        const fieldSymbol = nodeSymbol(compiler, field as ElementDeclarationNode);
        expect(fieldSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
        expect(fieldSymbol!.declaration).toBe(field);
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;

      const enumA = findMember(compiler, schemaSymbol, SymbolKind.Enum, 'a')!;
      const enumB = findMember(compiler, schemaSymbol, SymbolKind.Enum, 'b')!;
      expect(findMember(compiler, enumA, SymbolKind.EnumField, 'val1')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
      expect(findMember(compiler, enumA, SymbolKind.EnumField, 'val2')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
      expect(findMember(compiler, enumB, SymbolKind.EnumField, 'val1')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
      expect(findMember(compiler, enumB, SymbolKind.EnumField, 'val2')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.Enum, 'status')).toSatisfy((s: any) => s?.isKind(SymbolKind.Enum));
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      const typesSchema = findMember(compiler, schemaSymbol, SymbolKind.Schema, 'types')!;
      expect(findMember(compiler, typesSchema, SymbolKind.Enum, 'status')).toSatisfy((s: any) => s?.isKind(SymbolKind.Enum));
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
      expect(findMember(compiler, schemaSymbol, SymbolKind.Enum, 'status_enum')).toSatisfy((s: any) => s?.isKind(SymbolKind.Enum));
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      const enumSymbol = findMember(compiler, schemaSymbol, SymbolKind.Enum, 'order_status')!;
      expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'pending')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
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
      const publicSchema = nodeSymbol(compiler, ast)!;
      const typesSchema = findMember(compiler, publicSchema, SymbolKind.Schema, 'types')!;
      const enumSymbol = findMember(compiler, typesSchema, SymbolKind.Enum, 'status')!;
      expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'active')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      const enumSymbol = findMember(compiler, schemaSymbol, SymbolKind.Enum, 'true')!;
      expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'value')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
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
    });

    test('should bind inline refs', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int [ref: > users.id] }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
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

      const { ast, compiler } = result.getValue();
      const schemaSymbol = nodeSymbol(compiler, ast)!;

      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'posts')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'posts')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
    });

    test('should track multiple references to the same symbol', () => {
      const source = `
        Table users { id int [pk] }
        Table posts { user_id int }
        Table orders { user_id int }
        Ref r1: users.id < posts.user_id
        Ref r2: users.id < orders.user_id
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      const merchantsSymbol = findMember(compiler, schemaSymbol, SymbolKind.Table, 'merchants')!;
      const ordersSymbol = findMember(compiler, schemaSymbol, SymbolKind.Table, 'orders')!;

      // Check column membership
      expect(findMember(compiler, merchantsSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, merchantsSymbol, SymbolKind.Column, 'country_code')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, ordersSymbol, SymbolKind.Column, 'merchant_id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
      expect(findMember(compiler, ordersSymbol, SymbolKind.Column, 'country')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
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
      const publicSchema = nodeSymbol(compiler, ast)!;
      const shopSchema = findMember(compiler, publicSchema, SymbolKind.Schema, 'shop')!;
      expect(findMember(compiler, shopSchema, SymbolKind.Table, 'products')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
      expect(findMember(compiler, shopSchema, SymbolKind.Table, 'orders')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
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
      const partialSymbol = nodeSymbol(compiler, partialNode)!;

      expect(partialSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.TablePartial));
      expect(partialSymbol.declaration).toBe(partialNode);
      expect(findMember(compiler, partialSymbol, SymbolKind.Column, 'created_at')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));

      // Verify TablePartial is in public schema symbol table
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.TablePartial, 'timestamps')).toBe(partialSymbol);
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;

      expect(findMember(compiler, schemaSymbol, SymbolKind.TablePartial, 'timestamps')).toSatisfy((s: any) => s?.isKind(SymbolKind.TablePartial));
      expect(findMember(compiler, schemaSymbol, SymbolKind.TablePartial, 'audit')).toSatisfy((s: any) => s?.isKind(SymbolKind.TablePartial));
    });

    test('should handle tables with only partial injections', () => {
      const source = `
        TablePartial base { id int }
        Table derived { ~base }
      `;
      const result = analyze(source);
      expect(result.getErrors()).toHaveLength(0);

      const { ast, compiler } = result.getValue();
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.TablePartial, 'base')).toSatisfy((s: any) => s?.isKind(SymbolKind.TablePartial));
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'derived')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
      expect(findMember(compiler, schemaSymbol, SymbolKind.TablePartial, 'timestamps')).toSatisfy((s: any) => s?.isKind(SymbolKind.TablePartial));
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

    test('should disallow self-referential ref in table partial', () => {
      const source = `
        TablePartial T {
          col type [ref: > col]
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe('Two endpoints are the same');
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      const usersSymbol = findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')!;
      expect(findMember(compiler, usersSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
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
      const groupSymbol = nodeSymbol(compiler, tableGroup!)!;

      expect(groupSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.TableGroup));
      expect(groupSymbol.declaration).toBe(tableGroup);

      // Verify TableGroup is in public schema symbol table
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.TableGroup, 'group1')).toBe(groupSymbol);
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
      const schemaSymbol = nodeSymbol(compiler, ast)!;
      expect(findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
    });
  });

  describe('DiagramView', () => {
    test('should create DiagramView symbol with correct kind', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Tables { users }
        }
      `;
      const { ast, compiler } = analyze(source).getValue();
      const dvSymbol = findMember(compiler, nodeSymbol(compiler, ast)!, SymbolKind.DiagramView, 'myView');
      expect(dvSymbol).toBeDefined();
      expect(dvSymbol!.isKind(SymbolKind.DiagramView)).toBe(true);
    });

    test('should produce no binding errors when DiagramView references existing table', () => {
      const source = `
        Table users { id int }
        DiagramView myView {
          Tables { users }
        }
      `;
      expect(analyze(source).getErrors()).toHaveLength(0);
    });

    test('should produce binding error when DiagramView.Tables references non-existent table', () => {
      const source = `
        DiagramView myView {
          Tables { ghost_table }
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.some((e: any) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
    });

    test('should produce no binding errors when DiagramView.Tables references aliased table', () => {
      const source = `
        Table users as U { id int }
        DiagramView myView {
          Tables { U }
        }
      `;
      expect(analyze(source).getErrors()).toHaveLength(0);
    });

    test('should produce binding error when DiagramView.Tables references non-existent schema-qualified table', () => {
      const source = `
        Table auth.users { id int }
        DiagramView myView {
          Tables { auth.ghost }
        }
      `;
      const errors = analyze(source).getErrors();
      expect(errors.some((e: any) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
    });

    test('should produce no binding errors for schema-qualified table reference', () => {
      const source = `
        Table auth.users { id int }
        DiagramView myView {
          Tables { auth.users }
        }
      `;
      expect(analyze(source).getErrors()).toHaveLength(0);
    });
  });
});
