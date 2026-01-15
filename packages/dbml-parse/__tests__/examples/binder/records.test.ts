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
    expect(result.getErrors()).toHaveLength(0);

    const ast = result.getValue();
    const schemaSymbol = ast.symbol as SchemaSymbol;
    const tableSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;

    // Table and columns should have references from records
    expect(tableSymbol.references.length).toBe(1);
    expect(tableSymbol.references[0].referee).toBe(tableSymbol);

    const idColumn = tableSymbol.symbolTable.get('Column:id') as ColumnSymbol;
    const nameColumn = tableSymbol.symbolTable.get('Column:name') as ColumnSymbol;
    expect(idColumn.references.length).toBe(1);
    expect(nameColumn.references.length).toBe(1);
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
    expect(result.getErrors()).toHaveLength(0);

    const ast = result.getValue();
    const publicSchema = ast.symbol as SchemaSymbol;
    const authSchema = publicSchema.symbolTable.get('Schema:auth') as SchemaSymbol;
    const tableSymbol = authSchema.symbolTable.get('Table:users') as TableSymbol;

    expect(tableSymbol.references.length).toBe(1);
  });

  test('should detect unknown table in records', () => {
    const source = `
      records nonexistent(id) {
        1
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].diagnostic).toContain('nonexistent');
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
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].diagnostic).toContain('nonexistent');
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
    expect(result.getErrors()).toHaveLength(0);

    const ast = result.getValue();
    const schemaSymbol = ast.symbol as SchemaSymbol;
    const tableSymbol = schemaSymbol.symbolTable.get('Table:users') as TableSymbol;

    // Table should have 2 references from both records elements
    expect(tableSymbol.references.length).toBe(2);
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
    expect(result.getErrors()).toHaveLength(0);

    const ast = result.getValue();
    const schemaSymbol = ast.symbol as SchemaSymbol;
    const enumSymbol = schemaSymbol.symbolTable.get('Enum:status') as EnumSymbol;
    const activeField = enumSymbol.symbolTable.get('Enum field:active') as EnumFieldSymbol;

    // Enum field should have reference from records value
    expect(activeField.references.length).toBeGreaterThan(0);
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
    expect(result.getErrors()).toHaveLength(0);
  });
});
