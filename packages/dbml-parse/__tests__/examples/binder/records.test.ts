import { describe, expect, test } from 'vitest';
import { TableSymbol, EnumSymbol, ColumnSymbol, EnumFieldSymbol, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
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

    const ast = result.getValue();
    const schemaSymbol = ast.symbol as SchemaSymbol;
    const tableSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;

    // Table should have exactly 1 reference from records
    expect(tableSymbol.references.length).toBe(1);
    expect(tableSymbol.references[0].referee).toBe(tableSymbol);

    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const nameColumn = tableSymbol.symbolTable.get('Column:name') as ColumnSymbol;

    // Each column should have exactly 1 reference from records column list
    expect(idColumn.references.length).toBe(1);
    expect(idColumn.references[0].referee).toBe(idColumn);

    expect(nameColumn.references.length).toBe(1);
    expect(nameColumn.references[0].referee).toBe(nameColumn);
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

    const ast = result.getValue();
    const publicSchema = ast.symbol as SchemaSymbol;
    const authSchema = publicSchema.symbolTable.get('Schema:auth') as SchemaSymbol;
    const tableSymbol = authSchema.symbolTable.get('Table:users') as TableSymbol;

    // Schema should have reference from records
    expect(authSchema.references.length).toBe(1);
    expect(authSchema.references[0].referee).toBe(authSchema);

    // Table should have exactly 1 reference from records
    expect(tableSymbol.references.length).toBe(1);
    expect(tableSymbol.references[0].referee).toBe(tableSymbol);

    // Columns should have references
    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const emailColumn = tableSymbol.symbolTable.get('Column:email') as ColumnSymbol;

    expect(idColumn.references.length).toBe(1);

    expect(emailColumn.references.length).toBe(1);
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

    const ast = result.getValue();
    const schemaSymbol = ast.symbol as SchemaSymbol;
    const tableSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;

    // Table should have exactly 2 references from both records elements
    expect(tableSymbol.references.length).toBe(2);

    // Each column should have exactly 2 references
    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const nameColumn = tableSymbol.symbolTable.get('Column:name') as ColumnSymbol;

    expect(idColumn.references.length).toBe(2);

    expect(nameColumn.references.length).toBe(2);
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

    const ast = result.getValue();
    const schemaSymbol = ast.symbol as SchemaSymbol;
    const enumSymbol = schemaSymbol.symbolTable.get('Enum:status') as EnumSymbol;
    const activeField = enumSymbol.symbolTable.get('Enum field:active') as EnumFieldSymbol;

    // Enum should have 2 references: 1 from column type, 1 from records data
    expect(enumSymbol.references.length).toBe(2);

    // Enum field should have exactly 1 reference from records value
    expect(activeField.references.length).toBe(1);
    expect(activeField.references[0].referee).toBe(activeField);
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

    const ast = result.getValue();
    const schemaSymbol = ast.symbol as SchemaSymbol;
    const tableSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;

    // Verify forward reference is properly bound
    expect(tableSymbol.references.length).toBe(1);

    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const nameColumn = tableSymbol.symbolTable.get('Column:name') as ColumnSymbol;

    expect(idColumn.references.length).toBe(1);
    expect(nameColumn.references.length).toBe(1);
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

    const ast = result.getValue();
    const publicSchema = ast.symbol as SchemaSymbol;
    const authSchema = publicSchema.symbolTable.get('Schema:auth') as SchemaSymbol;
    const enumSymbol = authSchema.symbolTable.get('Enum:role') as EnumSymbol;

    // Enum should have 3 references: 1 from column type, 2 from records data
    expect(enumSymbol.references.length).toBe(3);

    const adminField = enumSymbol.symbolTable.get('Enum field:admin') as EnumFieldSymbol;
    const userField = enumSymbol.symbolTable.get('Enum field:user') as EnumFieldSymbol;

    expect(adminField.references.length).toBe(1);
    expect(adminField.references[0].referee).toBe(adminField);

    expect(userField.references.length).toBe(1);
    expect(userField.references[0].referee).toBe(userField);
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

    const ast = result.getValue();
    const schemaSymbol = ast.symbol as SchemaSymbol;
    const enumSymbol = schemaSymbol.symbolTable.get('Enum:status') as EnumSymbol;

    const pendingField = enumSymbol.symbolTable.get('Enum field:pending') as EnumFieldSymbol;
    const activeField = enumSymbol.symbolTable.get('Enum field:active') as EnumFieldSymbol;
    const completedField = enumSymbol.symbolTable.get('Enum field:completed') as EnumFieldSymbol;

    // pending is referenced twice
    expect(pendingField.references.length).toBe(2);

    // active is referenced once
    expect(activeField.references.length).toBe(1);

    // completed is referenced once
    expect(completedField.references.length).toBe(1);
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
