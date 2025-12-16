import renameTable from '../../src/renameTable';

describe('@dbml/core - renameTable with TablePartial', () => {
  test('should update refs inside TablePartial when table is renamed', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
}

TablePartial user_refs {
  user_id int [ref: > users.id]
  owner_id int [ref: > users.id]
}

Table posts {
  ~user_refs
  title varchar
}
`;

    const result = renameTable('users', 'customers', input);

    // Table should be renamed
    expect(result).toContain('customers');
    expect(result).not.toContain('users');

    // Refs from the partial should be updated
    const customerRefs = result.match(/customers\.id/g);
    expect(customerRefs).toHaveLength(2); // Both user_id and owner_id refs
  });

  test('should update schema-qualified refs in TablePartial', () => {
    const input = `
Table auth.users {
  id int [pk]
  email varchar
}

TablePartial auth_refs {
  user_id int [ref: > auth.users.id]
}

Table public.posts {
  ~auth_refs
  title varchar
}
`;

    const result = renameTable('auth.users', 'auth.customers', input);

    expect(result).toContain('auth.customers');
    expect(result).not.toContain('auth.users');

    // Ref should be updated
    expect(result).toContain('auth.customers.id');
  });

  test('should preserve TablePartial name when renaming table', () => {
    const input = `
Table users {
  id int [pk]
}

TablePartial user_template {
  created_at timestamp
  updated_at timestamp
}

Table posts {
  ~user_template
  user_id int [ref: > users.id]
}
`;

    const result = renameTable('users', 'customers', input);

    // Note: Token-based approach preserves TablePartial definitions
    // TablePartial and its fields remain in the output
    expect(result).toContain('created_at');
    expect(result).toContain('updated_at');

    // Table reference should be updated
    expect(result).toContain('customers');
    expect(result).not.toContain('Table users');
  });

  test('should handle multiple tables and partials', () => {
    const input = `
Table users {
  id int [pk]
}

Table products {
  id int [pk]
}

TablePartial audit_fields {
  created_by int [ref: > users.id]
  updated_by int [ref: > users.id]
}

Table orders {
  ~audit_fields
  product_id int [ref: > products.id]
}
`;

    const result = renameTable('users', 'customers', input);

    expect(result).toContain('customers');
    expect(result).not.toContain('users');
    expect(result).toContain('products'); // Should not change

    // Both refs to users should be updated
    const customerRefs = result.match(/customers\.id/g);
    expect(customerRefs).toHaveLength(2);

    // Product ref should remain
    expect(result).toContain('products.id');
  });

  test('should handle table partial with no refs', () => {
    const input = `
Table users {
  id int [pk]
}

TablePartial timestamps {
  created_at timestamp
  updated_at timestamp
}

Table users_extended {
  ~timestamps
  user_id int [ref: > users.id]
}
`;

    const result = renameTable('users', 'customers', input);

    expect(result).toContain('customers');
    expect(result).toContain('Table customers'); // users table renamed
    expect(result).toContain('Table users_extended'); // should not be renamed
    // Token-based approach preserves TablePartial definitions
    expect(result).toContain('created_at');
    expect(result).toContain('updated_at');
    expect(result).toContain('customers.id');
  });
});
