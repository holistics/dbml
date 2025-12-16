import renameTable from '../../src/renameTable';

describe('@dbml/core - renameTable collision detection', () => {
  test('should prevent collision when target name already exists in target schema', () => {
    const input = `
Table ecommerce.users {
  id int [pk]
  email varchar
}

Table public.users {
  id int [pk]
  username varchar
}

Table posts {
  ecommerce_user_id int [ref: > ecommerce.users.id]
  public_user_id int [ref: > users.id]
}
`;

    // Trying to rename ecommerce.users → users would collide with existing public.users
    const result = renameTable('ecommerce.users', 'users', input);

    // Should return unchanged DBML
    expect(result.trim()).toBe(input.trim());
    expect(result).toContain('ecommerce.users');
    expect(result).toContain('public.users');
  });

  test('should allow rename when no collision occurs', () => {
    const input = `
Table ecommerce.users {
  id int [pk]
  email varchar
}

Table posts {
  user_id int [ref: > ecommerce.users.id]
}
`;

    // No public.users exists, so this should work
    const result = renameTable('ecommerce.users', 'users', input);

    expect(result).toContain('Table users');
    expect(result).not.toContain('ecommerce.users');
    expect(result).toContain('users.id');
  });

  test('should prevent collision when renaming to same name in different schema', () => {
    const input = `
Table public.users {
  id int [pk]
  username varchar
}

Table auth.customers {
  id int [pk]
  email varchar
}
`;

    // Trying to rename auth.customers → public.customers when public.customers exists
    const result = renameTable('auth.customers', 'public.users', input);

    // Should return unchanged (collision detected)
    expect(result.trim()).toBe(input.trim());
  });

  test('should allow renaming to same name in different schema when no collision', () => {
    const input = `
Table auth.users {
  id int [pk]
  email varchar
}

Table posts {
  user_id int [ref: > auth.users.id]
}
`;

    // No public.customers exists, so renaming auth.users → public.customers should work
    // Result should be unqualified "customers" since public is default schema
    const result = renameTable('auth.users', 'public.customers', input);

    expect(result).toContain('Table customers');
    expect(result).toContain('customers.id');
    expect(result).not.toContain('auth.users');
  });

  test('should handle quoted table names in collision detection', () => {
    const input = `
Table "app users" {
  id int [pk]
}

Table "customers" {
  id int [pk]
}
`;

    // Trying to rename "app users" → "customers" should detect collision
    const result = renameTable('app users', 'customers', input);

    // Should return unchanged
    expect(result).toContain('"app users"');
    expect(result).toContain('"customers"');
    expect(result.trim()).toBe(input.trim());
  });

  test('should allow rename when only changing schema, not table name', () => {
    const input = `
Table ecommerce.users {
  id int [pk]
  email varchar
}

Table auth.customers {
  id int [pk]
}
`;

    // Renaming ecommerce.users → auth.users (different schema, same table name)
    // No auth.users exists, so this should work
    const result = renameTable('ecommerce.users', 'auth.users', input);

    expect(result).toContain('auth.users');
    expect(result).not.toContain('ecommerce.users');
  });

  test('should detect collision with unqualified table name', () => {
    const input = `
Table users {
  id int [pk]
}

Table auth.admins {
  id int [pk]
}
`;

    // Trying to rename auth.admins → users (implicitly public.users)
    // Should collide with existing unqualified "users"
    const result = renameTable('auth.admins', 'users', input);

    // Should return unchanged
    expect(result).toContain('Table users');
    expect(result).toContain('auth.admins');
    expect(result.trim()).toBe(input.trim());
  });

  test('should allow rename to same name (no-op)', () => {
    const input = `
Table users {
  id int [pk]
}
`;

    // Renaming users → users should be allowed (it's the same table)
    const result = renameTable('users', 'users', input);

    // Should return the same DBML (no changes needed)
    expect(result).toContain('Table users');
  });
});
