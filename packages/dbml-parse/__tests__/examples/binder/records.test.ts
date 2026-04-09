import { describe, expect, test } from 'vitest';
import { NodeSymbol, SymbolKind } from '@/core/types/symbols';
import { DEFAULT_SCHEMA_NAME, UNHANDLED } from '@/constants';
import { analyze } from '@tests/utils';

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
    const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
    const tableSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()!;

    // Table should have exactly 1 reference from records
    const tableRefs = compiler.symbolReferences(tableSymbol).getValue()!;
    expect(tableRefs.length).toBe(1);
    expect(compiler.nodeReferee(tableRefs[0]).getValue()).toBe(tableSymbol);

    const idColumn = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue()!;
    const nameColumn = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'name').getValue()!;

    // Each column should have exactly 1 reference from records column list
    const idRefs = compiler.symbolReferences(idColumn).getValue()!;
    expect(idRefs.length).toBe(1);
    expect(compiler.nodeReferee(idRefs[0]).getValue()).toBe(idColumn);

    const nameRefs = compiler.symbolReferences(nameColumn).getValue()!;
    expect(nameRefs.length).toBe(1);
    expect(compiler.nodeReferee(nameRefs[0]).getValue()).toBe(nameColumn);
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
    const programSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED)!;
    const authSchema = compiler.lookupMembers(programSymbol, SymbolKind.Schema, 'auth').getValue()!;
    const tableSymbol = compiler.lookupMembers(authSchema, SymbolKind.Table, 'users').getValue()!;

    // Schema should have reference from records
    const schemaRefs = compiler.symbolReferences(authSchema).getValue()!;
    expect(schemaRefs.length).toBe(1);
    expect(compiler.nodeReferee(schemaRefs[0]).getValue()).toBe(authSchema);

    // Table should have exactly 1 reference from records
    const tableRefs = compiler.symbolReferences(tableSymbol).getValue()!;
    expect(tableRefs.length).toBe(1);
    expect(compiler.nodeReferee(tableRefs[0]).getValue()).toBe(tableSymbol);

    // Columns should have references
    const idColumn = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue()!;
    const emailColumn = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'email').getValue()!;

    expect(compiler.symbolReferences(idColumn).getValue()!.length).toBe(1);
    expect(compiler.symbolReferences(emailColumn).getValue()!.length).toBe(1);
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
    const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
    const tableSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()!;

    // Table should have exactly 2 references from both records elements
    expect(compiler.symbolReferences(tableSymbol).getValue()!.length).toBe(2);

    // Each column should have exactly 2 references
    const idColumn = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue()!;
    const nameColumn = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'name').getValue()!;

    expect(compiler.symbolReferences(idColumn).getValue()!.length).toBe(2);
    expect(compiler.symbolReferences(nameColumn).getValue()!.length).toBe(2);
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
    const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
    const enumSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'status').getValue()!;
    const activeField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'active').getValue()!;

    // Enum should have 2 references: 1 from column type, 1 from records data
    expect(compiler.symbolReferences(enumSymbol).getValue()!.length).toBe(2);

    // Enum field should have exactly 1 reference from records value
    const activeRefs = compiler.symbolReferences(activeField).getValue()!;
    expect(activeRefs.length).toBe(1);
    expect(compiler.nodeReferee(activeRefs[0]).getValue()).toBe(activeField);
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
    const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
    const tableSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Table, 'users').getValue()!;

    // Verify forward reference is properly bound
    expect(compiler.symbolReferences(tableSymbol).getValue()!.length).toBe(1);

    const idColumn = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'id').getValue()!;
    const nameColumn = compiler.lookupMembers(tableSymbol, SymbolKind.Column, 'name').getValue()!;

    expect(compiler.symbolReferences(idColumn).getValue()!.length).toBe(1);
    expect(compiler.symbolReferences(nameColumn).getValue()!.length).toBe(1);
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
    const programSymbol = compiler.nodeSymbol(ast).getFiltered(UNHANDLED)!;
    const authSchema = compiler.lookupMembers(programSymbol, SymbolKind.Schema, 'auth').getValue()!;
    const enumSymbol = compiler.lookupMembers(authSchema, SymbolKind.Enum, 'role').getValue()!;

    // Enum should have 3 references: 1 from column type, 2 from records data
    expect(compiler.symbolReferences(enumSymbol).getValue()!.length).toBe(3);

    const adminField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'admin').getValue()!;
    const userField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'user').getValue()!;

    const adminRefs = compiler.symbolReferences(adminField).getValue()!;
    expect(adminRefs.length).toBe(1);
    expect(compiler.nodeReferee(adminRefs[0]).getValue()).toBe(adminField);

    const userRefs = compiler.symbolReferences(userField).getValue()!;
    expect(userRefs.length).toBe(1);
    expect(compiler.nodeReferee(userRefs[0]).getValue()).toBe(userField);
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
    const schemaSymbol = compiler.lookupMembers(ast, SymbolKind.Schema, DEFAULT_SCHEMA_NAME).getValue()!;
    const enumSymbol = compiler.lookupMembers(schemaSymbol, SymbolKind.Enum, 'status').getValue()!;

    const pendingField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'pending').getValue()!;
    const activeField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'active').getValue()!;
    const completedField = compiler.lookupMembers(enumSymbol, SymbolKind.EnumField, 'completed').getValue()!;

    // pending is referenced twice
    expect(compiler.symbolReferences(pendingField).getValue()!.length).toBe(2);

    // active is referenced once
    expect(compiler.symbolReferences(activeField).getValue()!.length).toBe(1);

    // completed is referenced once
    expect(compiler.symbolReferences(completedField).getValue()!.length).toBe(1);
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
