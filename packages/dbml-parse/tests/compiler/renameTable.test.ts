import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';

function renameTable (oldName: string, newName: string, input: string): string {
  const compiler = new Compiler();
  compiler.setSource(input);
  return compiler.renameTable(oldName, newName);
}

describe('@dbml/parse - renameTable', () => {
  describe('basic renaming', () => {
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
      expect(result).toContain('customers');
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
      const customerReferences = result.match(/customers\.id/g);
      expect(customerReferences).toHaveLength(2);
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
  });

  describe('schema handling', () => {
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
      expect(result).toContain('auth.customers.id');
      expect(result).toContain('users.id'); // public.users reference remains
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
      expect(result).toContain('auth.customers.id');
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
      const result = renameTable('ecommerce.users', 'users', input);
      expect(result).toContain('Table users');
      expect(result).not.toContain('ecommerce');
      expect(result).toContain('users.id');
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
  });

  describe('alias handling', () => {
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
      expect(result).toContain('as U');
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
      expect(result).toContain('as U');
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
      expect(result).toContain('as AuthUser');
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
      expect(result).toContain('as U');
      const customerReferences = result.match(/customers\.id/g);
      expect(customerReferences).toHaveLength(1);
      expect(result).toContain('U.id');
    });
  });

  describe('collision detection', () => {
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
      const result = renameTable('ecommerce.users', 'users', input);
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
      const result = renameTable('auth.customers', 'public.users', input);
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
      const result = renameTable('app users', 'customers', input);
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
      const result = renameTable('auth.admins', 'users', input);
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
      const result = renameTable('users', 'users', input);
      expect(result).toContain('Table users');
    });
  });

  describe('quoting', () => {
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
      expect(result).toContain('"customers"');
      expect(result).not.toContain('"users"');
    });

    test('should add quotes only to table name when needed, not schema', () => {
      const input = 'Table users { id int }';
      const result = renameTable('users', 'my users', input);
      expect(result).toContain('Table "my users"');
      expect(result).not.toContain('public');
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

  describe('TablePartial handling', () => {
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
      expect(result).toContain('customers');
      expect(result).not.toContain('users');
      const customerRefs = result.match(/customers\.id/g);
      expect(customerRefs).toHaveLength(2);
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
      expect(result).toContain('created_at');
      expect(result).toContain('updated_at');
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
      expect(result).toContain('products');
      const customerRefs = result.match(/customers\.id/g);
      expect(customerRefs).toHaveLength(2);
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
      expect(result).toContain('Table customers');
      expect(result).toContain('Table users_extended');
      expect(result).toContain('created_at');
      expect(result).toContain('updated_at');
      expect(result).toContain('customers.id');
    });
  });

  describe('complex scenarios', () => {
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
      expect(result).not.toContain('"users"');
      const customerMatches = result.match(/auth\.customers/g) || result.match(/customers/g);
      expect(customerMatches).not.toBeNull();
      expect(customerMatches!.length).toBeGreaterThanOrEqual(2);
    });
  });
});
