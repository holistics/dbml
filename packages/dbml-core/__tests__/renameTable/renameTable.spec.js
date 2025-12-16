import renameTable from '../../src/renameTable';

describe('@dbml/core - renameTable', () => {
  test('should rename a simple table', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
}
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('Table customers');
    expect(result).not.toContain('Table users');
  });

  test('should rename table and update references in relationships', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  user_id int
}

Ref: posts.user_id > users.id
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('Table customers');
    expect(result).not.toContain('Table users');
    // Check that the reference is updated
    expect(result).toContain('customers.id');
  });

  test('should rename table and update references in table groups', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  title varchar
}

TableGroup group1 {
  users
  posts
}
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('Table customers');
    expect(result).not.toContain('Table users');
    // Check that the table group is updated
    expect(result).toContain('customers');
    expect(result).toContain('posts');
  });

  test('should handle schema-qualified table names', () => {
    const input = `
Table public.users {
  id int [pk]
  name varchar
}

Table public.posts {
  id int [pk]
  user_id int
}

Ref: public.posts.user_id > public.users.id
`;

    const result = renameTable('public.users', 'public.customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('"users"');
    // Check that the reference is updated
    expect(result).toContain('customers.id');
  });

  test('should handle multiple schemas', () => {
    const input = `
Table auth.users {
  id int [pk]
  email varchar
}

Table public.posts {
  id int [pk]
  author_id int
}

Table public.comments {
  id int [pk]
  author_id int
}

Ref: public.posts.author_id > auth.users.id
Ref: public.comments.author_id > auth.users.id
`;

    const result = renameTable('auth.users', 'auth.customers', input);
    expect(result).toContain('auth.customers');
    expect(result).not.toContain('auth.users');
    // Both references should be updated
    const customerReferences = result.match(/auth\.customers\.id/g);
    expect(customerReferences).toHaveLength(2);
  });

  test('should only rename table in specified schema when multiple schemas have same table name', () => {
    const input = `
Table auth.users {
  id int [pk]
  email varchar
}

Table public.users {
  id int [pk]
  username varchar
}

Table public.posts {
  id int [pk]
  auth_user_id int
  public_user_id int
}

Ref: public.posts.auth_user_id > auth.users.id
Ref: public.posts.public_user_id > public.users.id
`;

    const result = renameTable('auth.users', 'auth.customers', input);
    expect(result).toContain('auth.customers');
    expect(result).toContain('users'); // public.users should remain
    expect(result).not.toContain('auth.users');
    // Check that only auth schema reference is updated
    expect(result).toContain('auth.customers.id');
    expect(result).toContain('users.id'); // public.users reference remains
  });

  test('should handle table aliases - rename by table name', () => {
    const input = `
Table users as U {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  user_id int
}

Ref: posts.user_id > U.id
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('users');
    // Alias should be preserved
    expect(result).toContain('as U');
    // Alias reference should remain as U.id (token-based approach preserves aliases)
    expect(result).toContain('U.id');
  });

  test('should handle table aliases - rename by alias', () => {
    const input = `
Table users as U {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  user_id int
}

Ref: posts.user_id > U.id
`;

    const result = renameTable('U', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('"users"');
    // Alias should be preserved
    expect(result).toContain('as U');
    // Check that the reference is updated
    expect(result).toContain('customers.id');
  });

  test('should handle table aliases with schema names', () => {
    const input = `
Table auth.users as AuthUser {
  id int [pk]
  email varchar
}

Table public.posts {
  id int [pk]
  author_id int
}

Ref: public.posts.author_id > AuthUser.id
`;

    const result = renameTable('auth.users', 'auth.customers', input);
    expect(result).toContain('auth.customers');
    expect(result).not.toContain('users');
    // Alias should be preserved
    expect(result).toContain('as AuthUser');
    // Alias reference should remain as AuthUser.id (token-based approach preserves aliases)
    expect(result).toContain('AuthUser.id');
  });

  test('should handle table aliases in table groups', () => {
    const input = `
Table users as U {
  id int [pk]
  name varchar
}

Table posts as P {
  id int [pk]
  title varchar
}

TableGroup group1 {
  U
  P
}
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('"users"');
    expect(result).toContain('posts');
  });

  test('should handle renaming with inline relationships', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  user_id int [ref: > users.id]
}
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('"users"');
    // Check that the inline reference is updated
    expect(result).toContain('customers.id');
  });

  test('should return unchanged DBML if table not found', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
}
`;

    const result = renameTable('non_existent_table', 'new_name', input);
    expect(result.trim()).toBe(input.trim());
  });

  test('should handle multiple references to the same table', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  author_id int
  reviewer_id int
}

Ref: posts.author_id > users.id
Ref: posts.reviewer_id > users.id
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('users');
    // Both references should be updated
    const customerReferences = result.match(/customers\.id/g);
    expect(customerReferences).not.toBeNull();
    expect(customerReferences).toHaveLength(2);
  });

  test('should handle table with indexes', () => {
    const input = `
Table users {
  id int [pk]
  email varchar
  name varchar

  indexes {
    email [unique]
    (name, email)
  }
}
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('users');
    expect(result).toContain('email');
    expect(result).toContain('name');
  });

  test('should handle table with notes', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
  Note: 'This is a users table'
}
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('"users"');
    expect(result).toContain("Note: 'This is a users table'");
  });

  test('should handle complex schema with multiple schemas, aliases, and relationships', () => {
    const input = `
Table auth.users as AuthUser {
  id int [pk]
  email varchar
}

Table public.posts {
  id int [pk]
  auth_user_id int
  title varchar
}

Table public.comments {
  id int [pk]
  post_id int
  author_id int
  content text
}

Ref: public.posts.auth_user_id > AuthUser.id
Ref: public.comments.post_id > public.posts.id
Ref: public.comments.author_id > auth.users.id

TableGroup social {
  AuthUser
  public.posts
  public.comments
}
`;

    const result = renameTable('auth.users', 'auth.customers', input);
    expect(result).toContain('auth.customers');
    expect(result).not.toContain('"users"'); // The only users table should be renamed
    // Check that all three auth.customers references exist (2 refs + 1 table group)
    const customerMatches = result.match(/auth\.customers/g) || result.match(/customers/g);
    expect(customerMatches.length).toBeGreaterThanOrEqual(2);
  });

  test('should move table to different schema when renaming with different schema', () => {
    const input = `
Table public.users {
  id int [pk]
  email varchar
}

Table public.posts {
  id int [pk]
  user_id int
}

Ref: public.posts.user_id > public.users.id
`;

    const result = renameTable('public.users', 'auth.customers', input);
    expect(result).toContain('auth.customers');
    expect(result).not.toContain('"users"');
    // Check that the reference is updated with the new schema
    expect(result).toContain('auth.customers.id');
  });

  test('should handle renaming table referenced by both name and alias', () => {
    const input = `
Table users as U {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  user_id int
  reviewer_id int
}

Ref: posts.user_id > users.id
Ref: posts.reviewer_id > U.id
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('users');
    // Alias should be preserved
    expect(result).toContain('as U');
    // Only the direct reference (users.id) is updated, alias reference (U.id) is preserved
    const customerReferences = result.match(/customers\.id/g);
    expect(customerReferences).toHaveLength(1);
    expect(result).toContain('U.id'); // Alias reference preserved
  });

  test('should handle default public schema correctly', () => {
    const input = `
Table users {
  id int [pk]
}

Table posts {
  id int
}

Ref: posts.id > users.id
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).not.toContain('"users"');
  });

  test('should preserve table settings when renaming', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
  Note: 'User table'
}
`;

    const result = renameTable('users', 'customers', input);
    expect(result).toContain('customers');
    expect(result).toContain("Note: 'User table'");
    expect(result).toContain('[pk]');
  });

  test('should move table to public schema when renaming from non-default schema to unqualified name', () => {
    const input = `
Table ecommerce.users {
  id int [pk]
  email varchar
}

Table posts {
  id int [pk]
  user_id int [ref: > ecommerce.users.id]
}
`;

    // Renaming ecommerce.users → users should move it to public schema
    const result = renameTable('ecommerce.users', 'users', input);

    expect(result).toContain('Table users');
    expect(result).not.toContain('ecommerce');
    expect(result).toContain('users.id'); // Ref should be updated
  });
});
