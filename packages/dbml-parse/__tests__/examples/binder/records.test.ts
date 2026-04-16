import { describe, expect, test } from 'vitest';
import { SchemaSymbol, NodeSymbol, SymbolKind } from '@/core/types/symbol';
import { UNHANDLED } from '@/core/types/module';
import { analyze } from '@tests/utils';
import { ProgramNode, ElementDeclarationNode } from '@/core/types/nodes';
import type Compiler from '@/compiler';

function findMember (compiler: Compiler, symbol: NodeSymbol, kind: SymbolKind, name: string): NodeSymbol | undefined {
  const members = compiler.symbolMembers(symbol).getFiltered(UNHANDLED) ?? [];
  return members.find((m) => m.kind === kind && compiler.symbolName(m) === name);
}

function nodeSymbol (compiler: Compiler, node: ElementDeclarationNode | ProgramNode): NodeSymbol | undefined {
  return compiler.nodeSymbol(node).getFiltered(UNHANDLED);
}

describe('[example] records binder', () => {
  test('should bind records to table and columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }
    `;
    const result = analyze(source);
    expect(result.getErrors().length).toBe(0);

    const { ast, compiler } = result.getValue();
    const schemaSymbol = nodeSymbol(compiler, ast)!;
    const tableSymbol = findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')!;

    expect(tableSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
    expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
    expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
  });

  test('should bind records with schema-qualified table', () => {
    const source = `
      Table auth.users {
        id int
        email varchar
      }
      records auth.users(id, email) {
        1, "alice@example.com"
      }
    `;
    const result = analyze(source);
    expect(result.getErrors().length).toBe(0);

    const { ast, compiler } = result.getValue();
    const publicSchema = nodeSymbol(compiler, ast)!;
    const authSchema = findMember(compiler, publicSchema, SymbolKind.Schema, 'auth')!;
    const tableSymbol = findMember(compiler, authSchema, SymbolKind.Table, 'users')!;

    expect(authSchema).toSatisfy((s: any) => s?.isKind(SymbolKind.Schema));
    expect(tableSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
    expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
    expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'email')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
  });

  test('should detect unknown table in records', () => {
    const source = `
      records nonexistent(id) {
        1
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Table 'nonexistent' does not exist in Schema 'public'");
  });

  test('should detect unknown column in records', () => {
    const source = `
      Table users {
        id int
      }
      records users(id, nonexistent) {
        1, "value"
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Column 'nonexistent' does not exist in Table 'users'");
  });

  test('should bind multiple records for same table', () => {
    const source = `
      Table users {
        id int
        name varchar
      }
      records users(id, name) {
        1, "Alice"
      }
      records users(id, name) {
        2, "Bob"
      }
    `;
    const result = analyze(source);
    expect(result.getErrors().length).toBe(0);

    const { ast, compiler } = result.getValue();
    const schemaSymbol = nodeSymbol(compiler, ast)!;
    const tableSymbol = findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')!;

    expect(tableSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
    expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
    expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
  });

  test('should bind records with enum column type', () => {
    const source = `
      Enum status { active\n inactive }
      Table users {
        id int
        status status
      }
      records users(id, status) {
        1, status.active
      }
    `;
    const result = analyze(source);
    expect(result.getErrors().length).toBe(0);

    const { ast, compiler } = result.getValue();
    const schemaSymbol = nodeSymbol(compiler, ast)!;
    const enumSymbol = findMember(compiler, schemaSymbol, SymbolKind.Enum, 'status')!;
    expect(enumSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Enum));
    expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'active')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
  });

  test('should allow forward reference to table in records', () => {
    const source = `
      records users(id, name) {
        1, "Alice"
      }
      Table users {
        id int
        name varchar
      }
    `;
    const result = analyze(source);
    expect(result.getErrors().length).toBe(0);

    const { ast, compiler } = result.getValue();
    const schemaSymbol = nodeSymbol(compiler, ast)!;
    const tableSymbol = findMember(compiler, schemaSymbol, SymbolKind.Table, 'users')!;

    expect(tableSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Table));
    expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'id')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
    expect(findMember(compiler, tableSymbol, SymbolKind.Column, 'name')).toSatisfy((s: any) => s?.isKind(SymbolKind.Column));
  });

  test('should bind schema-qualified enum values in records', () => {
    const source = `
      Enum auth.role { admin\n user\n guest }
      Table auth.users {
        id int
        role auth.role
      }
      records auth.users(id, role) {
        1, auth.role.admin
        2, auth.role.user
      }
    `;
    const result = analyze(source);
    expect(result.getErrors().length).toBe(0);

    const { ast, compiler } = result.getValue();
    const publicSchema = nodeSymbol(compiler, ast)!;
    const authSchema = findMember(compiler, publicSchema, SymbolKind.Schema, 'auth')!;
    const enumSymbol = findMember(compiler, authSchema, SymbolKind.Enum, 'role')!;

    expect(enumSymbol).toSatisfy((s: any) => s?.isKind(SymbolKind.Enum));
    expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'admin')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
    expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'user')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
  });

  test('should detect unknown enum in records data', () => {
    const source = `
      Table users {
        id int
        status varchar
      }
      records users(id, status) {
        1, unknown_enum.value
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Enum 'unknown_enum' does not exist in Schema 'public'");
  });

  test('should detect unknown enum field in records data', () => {
    const source = `
      Enum status { active\n inactive }
      Table users {
        id int
        status status
      }
      records users(id, status) {
        1, status.unknown_field
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Enum field 'unknown_field' does not exist in Enum 'status'");
  });

  test('should bind multiple enum field references in same records', () => {
    const source = `
      Enum status { pending\n active\n completed }
      Table tasks {
        id int
        status status
      }
      records tasks(id, status) {
        1, status.pending
        2, status.active
        3, status.completed
        4, status.pending
      }
    `;
    const result = analyze(source);
    expect(result.getErrors().length).toBe(0);

    const { ast, compiler } = result.getValue();
    const schemaSymbol = nodeSymbol(compiler, ast)!;
    const enumSymbol = findMember(compiler, schemaSymbol, SymbolKind.Enum, 'status')!;

    expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'pending')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
    expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'active')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
    expect(findMember(compiler, enumSymbol, SymbolKind.EnumField, 'completed')).toSatisfy((s: any) => s?.isKind(SymbolKind.EnumField));
  });

  test('should error when there are duplicate columns in top-level records', () => {
    const source = `
      Table tasks {
        id int
        status status
      }
      records tasks(id, id, "id") {
        1, 10
        2, 20
        3, 30
        4, 40
      }
    `;
    const result = analyze(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(4);
    expect(errors[0].message).toBe('Column \'id\' is referenced more than once in a Records for Table \'tasks\'');
    expect(errors[1].message).toBe('Column \'id\' is referenced more than once in a Records for Table \'tasks\'');
    expect(errors[2].message).toBe('Column \'id\' is referenced more than once in a Records for Table \'tasks\'');
    expect(errors[3].message).toBe('Column \'id\' is referenced more than once in a Records for Table \'tasks\'');
  });
});
