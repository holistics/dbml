import { describe, expect, test } from 'vitest';
import { TableSymbol, EnumSymbol, ColumnSymbol, EnumFieldSymbol, SchemaSymbol } from '@/core/analyzer/symbol/symbols';
import { Compiler } from '@/index';
import { DEFAULT_ENTRY } from '@/compiler/constants';

function createCompiler (source: string): Compiler {
  const compiler = new Compiler();
  compiler.setSource(source);
  return compiler;
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
    const compiler = createCompiler(source);
    const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
    expect(compiler.parseFile(DEFAULT_ENTRY).getErrors().length).toBe(0);

    const schemaSymbol = compiler.resolvedSymbol(ast) as SchemaSymbol;
    const tableSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;

    // Table should have exactly 1 reference from records
    expect(compiler.nodeReferences(tableSymbol.declaration!).length).toBe(1);
    expect(compiler.nodeReferee(compiler.nodeReferences(tableSymbol.declaration!)[0])).toBe(tableSymbol);

    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const nameColumn = tableSymbol.symbolTable.get('Column:name') as ColumnSymbol;

    // Each column should have exactly 1 reference from records column list
    expect(compiler.nodeReferences(idColumn.declaration!).length).toBe(1);
    expect(compiler.nodeReferee(compiler.nodeReferences(idColumn.declaration!)[0])).toBe(idColumn);

    expect(compiler.nodeReferences(nameColumn.declaration!).length).toBe(1);
    expect(compiler.nodeReferee(compiler.nodeReferences(nameColumn.declaration!)[0])).toBe(nameColumn);
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
    const compiler = createCompiler(source);
    const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
    expect(compiler.parseFile(DEFAULT_ENTRY).getErrors().length).toBe(0);

    const publicSchema = compiler.resolvedSymbol(ast) as SchemaSymbol;
    const authSchema = publicSchema.symbolTable.get('Schema:auth') as SchemaSymbol;
    const tableSymbol = authSchema.symbolTable.get('Table:users') as TableSymbol;

    // Schema should have reference from records
    const authSchemaRefs = compiler.analyzeProject(DEFAULT_ENTRY).getValue().symbolToReferences.get(authSchema) ?? [];
    expect(authSchemaRefs.length).toBe(1);
    expect(compiler.nodeReferee(authSchemaRefs[0])).toBe(authSchema);
    // Table should have exactly 1 reference from records
    expect(compiler.nodeReferences(tableSymbol.declaration!).length).toBe(1);
    expect(compiler.nodeReferee(compiler.nodeReferences(tableSymbol.declaration!)[0])).toBe(tableSymbol);

    // Columns should have references
    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const emailColumn = tableSymbol.symbolTable.get('Column:email') as ColumnSymbol;

    expect(compiler.nodeReferences(idColumn.declaration!).length).toBe(1);

    expect(compiler.nodeReferences(emailColumn.declaration!).length).toBe(1);
  });

  test('should detect unknown table in records', () => {
    const source = `
      records nonexistent(id) {
        1
      }
    `;
    const compiler = createCompiler(source);
    compiler.parseFile(DEFAULT_ENTRY);
    const errors = compiler.analyzeProject(DEFAULT_ENTRY).getErrors();
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
    const compiler = createCompiler(source);
    compiler.parseFile(DEFAULT_ENTRY);
    const errors = compiler.analyzeProject(DEFAULT_ENTRY).getErrors();
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
    const compiler = createCompiler(source);
    const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
    expect(compiler.parseFile(DEFAULT_ENTRY).getErrors().length).toBe(0);

    const schemaSymbol = compiler.resolvedSymbol(ast) as SchemaSymbol;
    const tableSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;

    // Table should have exactly 2 references from both records elements
    expect(compiler.nodeReferences(tableSymbol.declaration!).length).toBe(2);

    // Each column should have exactly 2 references
    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const nameColumn = tableSymbol.symbolTable.get('Column:name') as ColumnSymbol;

    expect(compiler.nodeReferences(idColumn.declaration!).length).toBe(2);

    expect(compiler.nodeReferences(nameColumn.declaration!).length).toBe(2);
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
    const compiler = createCompiler(source);
    const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
    expect(compiler.parseFile(DEFAULT_ENTRY).getErrors().length).toBe(0);

    const schemaSymbol = compiler.resolvedSymbol(ast) as SchemaSymbol;
    const enumSymbol = schemaSymbol.symbolTable.get('Enum:status') as EnumSymbol;
    const activeField = enumSymbol.symbolTable.get('Enum field:active') as EnumFieldSymbol;

    // Enum should have 2 references: 1 from column type, 1 from records data
    expect(compiler.nodeReferences(enumSymbol.declaration!).length).toBe(2);

    // Enum field should have exactly 1 reference from records value
    expect(compiler.nodeReferences(activeField.declaration!).length).toBe(1);
    expect(compiler.nodeReferee(compiler.nodeReferences(activeField.declaration!)[0])).toBe(activeField);
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
    const compiler = createCompiler(source);
    const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
    expect(compiler.parseFile(DEFAULT_ENTRY).getErrors().length).toBe(0);

    const schemaSymbol = compiler.resolvedSymbol(ast) as SchemaSymbol;
    const tableSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;

    // Verify forward reference is properly bound
    expect(compiler.nodeReferences(tableSymbol.declaration!).length).toBe(1);

    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const nameColumn = tableSymbol.symbolTable.get('Column:name') as ColumnSymbol;

    expect(compiler.nodeReferences(idColumn.declaration!).length).toBe(1);
    expect(compiler.nodeReferences(nameColumn.declaration!).length).toBe(1);
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
    const compiler = createCompiler(source);
    const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
    expect(compiler.parseFile(DEFAULT_ENTRY).getErrors().length).toBe(0);

    const publicSchema = compiler.resolvedSymbol(ast) as SchemaSymbol;
    const authSchema = publicSchema.symbolTable.get('Schema:auth') as SchemaSymbol;
    const enumSymbol = authSchema.symbolTable.get('Enum:role') as EnumSymbol;

    // Enum should have 3 references: 1 from column type, 2 from records data
    expect(compiler.nodeReferences(enumSymbol.declaration!).length).toBe(3);

    const adminField = enumSymbol.symbolTable.get('Enum field:admin') as EnumFieldSymbol;
    const userField = enumSymbol.symbolTable.get('Enum field:user') as EnumFieldSymbol;

    expect(compiler.nodeReferences(adminField.declaration!).length).toBe(1);
    expect(compiler.nodeReferee(compiler.nodeReferences(adminField.declaration!)[0])).toBe(adminField);

    expect(compiler.nodeReferences(userField.declaration!).length).toBe(1);
    expect(compiler.nodeReferee(compiler.nodeReferences(userField.declaration!)[0])).toBe(userField);
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
    const compiler = createCompiler(source);
    compiler.parseFile(DEFAULT_ENTRY);
    const errors = compiler.analyzeProject(DEFAULT_ENTRY).getErrors();
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
    const compiler = createCompiler(source);
    compiler.parseFile(DEFAULT_ENTRY);
    const errors = compiler.analyzeProject(DEFAULT_ENTRY).getErrors();
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
    const compiler = createCompiler(source);
    const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
    expect(compiler.parseFile(DEFAULT_ENTRY).getErrors().length).toBe(0);

    const schemaSymbol = compiler.resolvedSymbol(ast) as SchemaSymbol;
    const enumSymbol = schemaSymbol.symbolTable.get('Enum:status') as EnumSymbol;

    const pendingField = enumSymbol.symbolTable.get('Enum field:pending') as EnumFieldSymbol;
    const activeField = enumSymbol.symbolTable.get('Enum field:active') as EnumFieldSymbol;
    const completedField = enumSymbol.symbolTable.get('Enum field:completed') as EnumFieldSymbol;

    // pending is referenced twice
    expect(compiler.nodeReferences(pendingField.declaration!).length).toBe(2);

    // active is referenced once
    expect(compiler.nodeReferences(activeField.declaration!).length).toBe(1);

    // completed is referenced once
    expect(compiler.nodeReferences(completedField.declaration!).length).toBe(1);
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
    const compiler = createCompiler(source);
    compiler.parseFile(DEFAULT_ENTRY);
    const errors = compiler.analyzeProject(DEFAULT_ENTRY).getErrors();
    expect(errors.length).toBe(4);
    expect(errors[0].message).toBe('Column \'id\' is referenced more than once in a Records for Table \'tasks\'');
    expect(errors[1].message).toBe('Column \'id\' is referenced more than once in a Records for Table \'tasks\'');
    expect(errors[2].message).toBe('Column \'id\' is referenced more than once in a Records for Table \'tasks\'');
    expect(errors[3].message).toBe('Column \'id\' is referenced more than once in a Records for Table \'tasks\'');
  });
});
