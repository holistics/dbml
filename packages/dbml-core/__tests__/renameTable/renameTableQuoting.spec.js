import renameTable from '../../src/renameTable';

describe('@dbml/core - renameTable with quoting', () => {
  test('should preserve quotes when original table uses quotes', () => {
    const input = 'Table "users" { id int }';
    const result = renameTable('users', 'customers', input);

    expect(result).toContain('"customers"');
    expect(result).not.toContain('users');
  });

  test('should add quotes when new name contains spaces', () => {
    const input = `
Table users { id int }
Table posts { user_id int [ref: > users.id] }
`;

    const result = renameTable('users', 'app users', input);

    expect(result).toContain('"app users"');
    expect(result).toContain('"app users".id');
    expect(result).not.toContain('Table users');
  });

  test('should add quotes when new name contains hyphens', () => {
    const input = 'Table users { id int }';
    const result = renameTable('users', 'app-users', input);

    expect(result).toContain('"app-users"');
  });

  test('should not add quotes for valid identifiers', () => {
    const input = 'Table users { id int }';
    const result = renameTable('users', 'customers', input);

    expect(result).toContain('Table customers');
    expect(result).not.toContain('"customers"');
  });

  test('should handle special characters in quoted names', () => {
    const input = 'Table users { id int }';
    const result = renameTable('users', 'user@domain', input);

    expect(result).toContain('"user@domain"');
  });

  test('should preserve quotes when schema-qualified table uses quotes', () => {
    const input = 'Table "schema1"."users" { id int }';
    const result = renameTable('schema1.users', 'schema1.customers', input);

    // Should preserve quotes if original used them
    expect(result).toContain('"customers"');
    expect(result).not.toContain('"users"');
  });

  test('should add quotes only to table name when needed, not schema', () => {
    const input = 'Table users { id int }';
    const result = renameTable('users', 'my users', input);

    // Should be: Table "my users" { ... }
    // NOT: Table "public"."my users" { ... }
    expect(result).toContain('Table "my users"');
    expect(result).not.toContain('public');
  });

  test('should handle quoted names in relationships', () => {
    const input = `
Table "app users" {
  id int [pk]
}

Table posts {
  user_id int [ref: > "app users".id]
}
`;

    const result = renameTable('app users', 'customers', input);

    expect(result).toContain('Table "customers"');
    expect(result).toContain('"customers".id');
    expect(result).not.toContain('"app users"');
  });

  test('should preserve quotes in check constraints', () => {
    const input = `
Table users {
  status varchar [check: \`users.status IN ('active', 'inactive')\`]
}
`;

    const result = renameTable('users', 'app users', input);

    expect(result).toContain('"app users"');
    expect(result).toContain('`"app users".status IN');
  });

  test('should handle mixed quoted and unquoted references', () => {
    const input = `
Table "users" {
  id int [pk]
}

Table posts {
  user_id int [ref: > "users".id]
}

TableGroup group1 {
  "users"
  posts
}
`;

    const result = renameTable('users', 'customers', input);

    expect(result).toContain('Table "customers"');
    expect(result).toContain('"customers".id');
    expect(result).toContain('"customers"');
    expect(result).not.toContain('"users"');
  });
});
