import {
  describe, expect, test,
} from 'vitest';
import Compiler from '@/compiler/index';
import { TableNameInput } from '@/compiler/queries/transform';
import { DEFAULT_ENTRY } from '@/constants';
import { Filepath } from '@/core/types/filepath';

function renameTable (
  oldName: TableNameInput,
  newName: TableNameInput,
  input: string,
): string {
  const compiler = new Compiler();
  compiler.setSource(DEFAULT_ENTRY, input);
  const layout = compiler.renameTable(DEFAULT_ENTRY, oldName, newName);
  return layout.getSource(DEFAULT_ENTRY) ?? input;
}

describe('[example] renameTable (string format)', () => {
  test('should accept string format for simple table names', () => {
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

  test('should accept string format with schema.table', () => {
    const input = `
Table auth.users {
  id int [pk]
}
`;
    const result = renameTable('auth.users', 'auth.customers', input);
    expect(result).toContain('auth.customers');
    expect(result).not.toContain('auth.users');
  });

  test('should update references when using bare string format', () => {
    const input = `
Table users {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  user_id int [ref: > users.id]
}

Ref: posts.user_id > users.id
`;
    const result = renameTable('users', 'customers', input);
    expect(result).toContain('Table customers');
    expect(result).not.toContain('Table users');
    expect(result).toContain('customers.id');
    expect(result).not.toContain('users.id');
  });

  test('should handle moving table between schemas with bare string', () => {
    const input = `
Table public.users {
  id int [pk]
}

Table posts {
  user_id int [ref: > public.users.id]
}
`;
    const result = renameTable('public.users', 'auth.customers', input);
    expect(result).toContain('auth.customers');
    expect(result).not.toContain('public.users');
    expect(result).toContain('auth.customers.id');
  });

  test('should handle bare string with only new schema specified', () => {
    const input = `
Table users {
  id int [pk]
}
`;
    const result = renameTable('users', 'auth.users', input);
    expect(result).toContain('auth.users');
    expect(result).not.toContain('Table users {');
  });

  test('should handle removing schema qualification with bare string', () => {
    const input = `
Table auth.users {
  id int [pk]
}

Table posts {
  user_id int [ref: > auth.users.id]
}
`;
    const result = renameTable('auth.users', 'users', input);
    expect(result).toContain('Table users');
    expect(result).not.toContain('auth.users');
    expect(result).toContain('users.id');
  });

  test('should handle mixed bare string and object inputs - string old, object new', () => {
    const input = `
Table users {
  id int [pk]
}
`;
    const result = renameTable('users', {
      table: 'customers',
    }, input);
    expect(result).toContain('Table customers');
    expect(result).not.toContain('Table users');
  });

  test('should handle mixed bare string and object inputs - object old, string new', () => {
    const input = `
Table users {
  id int [pk]
}
`;
    const result = renameTable({
      table: 'users',
    }, 'customers', input);
    expect(result).toContain('Table customers');
    expect(result).not.toContain('Table users');
  });

  test('should handle bare string for table not found', () => {
    const input = `
Table users {
  id int [pk]
}
`;
    const result = renameTable('nonexistent', 'customers', input);
    expect(result).toBe(input);
  });

  test('should handle bare string collision detection', () => {
    const input = `
Table users {
  id int [pk]
}

Table customers {
  id int [pk]
}
`;
    const result = renameTable('users', 'customers', input);
    expect(result).toBe(input);
  });

  test('should handle bare string with table groups', () => {
    const input = `
Table users {
  id int [pk]
}

Table posts {
  id int [pk]
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
  });

  test('should handle bare string with table alias', () => {
    const input = `
Table users as U {
  id int [pk]
}

Table posts {
  user_id int [ref: > U.id]
}
`;
    const result = renameTable('users', 'customers', input);
    expect(result).toContain('Table customers');
    expect(result).not.toContain('Table users');
    expect(result).toContain('as U');
  });

  test('should handle bare string renaming same name (no-op)', () => {
    const input = `
Table users {
  id int [pk]
}
`;
    const result = renameTable('users', 'users', input);
    expect(result).toContain('Table users');
  });

  test('should handle bare string that needs quoting in new name', () => {
    const input = `
Table users {
  id int [pk]
}

Table posts {
  user_id int [ref: > users.id]
}
`;
    const result = renameTable('users', 'app users', input);
    expect(result).toContain('"app users"');
    expect(result).toContain('"app users".id');
    expect(result).not.toContain('Table users');
  });

  test('should handle bare string with multiple schemas having same table name', () => {
    const input = `
Table auth.users {
  id int [pk]
}

Table public.users {
  id int [pk]
}

Table posts {
  auth_user_id int [ref: > auth.users.id]
  public_user_id int [ref: > public.users.id]
}
`;
    const result = renameTable('auth.users', 'auth.customers', input);
    expect(result).toContain('auth.customers');
    expect(result).toContain('public.users'); // should remain unchanged
    expect(result).not.toContain('auth.users');
  });
});

describe('[example] renameTable', () => {
  describe('basic renaming', () => {
    test('should rename a simple table', () => {
      const input = `
Table users {
  id int [pk]
  name varchar
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'non_existent_table',
      }, {
        table: 'new_name',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable(
        {
          schema: 'public',
          table: 'users',
        },
        {
          schema: 'public',
          table: 'customers',
        },
        input,
      );
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
      const result = renameTable(
        {
          schema: 'auth',
          table: 'users',
        },
        {
          schema: 'auth',
          table: 'customers',
        },
        input,
      );
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
      const result = renameTable(
        {
          schema: 'auth',
          table: 'users',
        },
        {
          schema: 'auth',
          table: 'customers',
        },
        input,
      );
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
      const result = renameTable(
        {
          schema: 'public',
          table: 'users',
        },
        {
          schema: 'auth',
          table: 'customers',
        },
        input,
      );
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
      const result = renameTable(
        {
          schema: 'ecommerce',
          table: 'users',
        },
        {
          table: 'users',
        },
        input,
      );
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'U',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable(
        {
          schema: 'auth',
          table: 'users',
        },
        {
          schema: 'auth',
          table: 'customers',
        },
        input,
      );
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable(
        {
          schema: 'ecommerce',
          table: 'users',
        },
        {
          table: 'users',
        },
        input,
      );
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
      const result = renameTable(
        {
          schema: 'ecommerce',
          table: 'users',
        },
        {
          table: 'users',
        },
        input,
      );
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
      const result = renameTable(
        {
          schema: 'auth',
          table: 'customers',
        },
        {
          schema: 'public',
          table: 'users',
        },
        input,
      );
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
      const result = renameTable(
        {
          schema: 'auth',
          table: 'users',
        },
        {
          schema: 'public',
          table: 'customers',
        },
        input,
      );
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
      const result = renameTable({
        table: 'app users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable(
        {
          schema: 'ecommerce',
          table: 'users',
        },
        {
          schema: 'auth',
          table: 'users',
        },
        input,
      );
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
      const result = renameTable(
        {
          schema: 'auth',
          table: 'admins',
        },
        {
          table: 'users',
        },
        input,
      );
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'users',
      }, input);
      expect(result).toContain('Table users');
    });
  });

  describe('quoting', () => {
    test('should preserve quotes when original table uses quotes', () => {
      const input = 'Table "users" { id int }';
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('"customers"');
      expect(result).not.toContain('users');
    });

    test('should add quotes when new name contains spaces', () => {
      const input = `
Table users { id int }
Table posts { user_id int [ref: > users.id] }
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'app users',
      }, input);
      expect(result).toContain('"app users"');
      expect(result).toContain('"app users".id');
      expect(result).not.toContain('Table users');
    });

    test('should add quotes when new name contains hyphens', () => {
      const input = 'Table users { id int }';
      const result = renameTable({
        table: 'users',
      }, {
        table: 'app-users',
      }, input);
      expect(result).toContain('"app-users"');
    });

    test('should not add quotes for valid identifiers', () => {
      const input = 'Table users { id int }';
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('Table customers');
      expect(result).not.toContain('"customers"');
    });

    test('should handle special characters in quoted names', () => {
      const input = 'Table users { id int }';
      const result = renameTable({
        table: 'users',
      }, {
        table: 'user@domain',
      }, input);
      expect(result).toContain('"user@domain"');
    });

    test('should preserve quotes when schema-qualified table uses quotes', () => {
      const input = 'Table "schema1"."users" { id int }';
      const result = renameTable(
        {
          schema: 'schema1',
          table: 'users',
        },
        {
          schema: 'schema1',
          table: 'customers',
        },
        input,
      );
      expect(result).toContain('"customers"');
      expect(result).not.toContain('"users"');
    });

    test('should add quotes only to table name when needed, not schema', () => {
      const input = 'Table users { id int }';
      const result = renameTable({
        table: 'users',
      }, {
        table: 'my users',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable(
        {
          schema: 'auth',
          table: 'users',
        },
        {
          schema: 'auth',
          table: 'customers',
        },
        input,
      );
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
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
      const result = renameTable(
        {
          schema: 'auth',
          table: 'users',
        },
        {
          schema: 'auth',
          table: 'customers',
        },
        input,
      );
      expect(result).toContain('auth.customers');
      expect(result).not.toContain('"users"');
      const customerMatches = result.match(/auth\.customers/g) || result.match(/customers/g);
      expect(customerMatches).not.toBeNull();
      expect(customerMatches!.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('malformed and edge cases', () => {
    test('should handle empty input', () => {
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, '');
      expect(result).toBe('');
    });

    test('should handle whitespace-only input', () => {
      const input = '   \n\t\n   ';
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toBe(input);
    });

    test('should handle DBML with only comments', () => {
      const input = `
// This is a comment
// Another comment
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toBe(input);
    });

    test('should handle malformed DBML - unclosed brace', () => {
      const input = `
Table users {
  id int [pk]
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('customers');
    });

    test('should handle malformed DBML - missing column type', () => {
      const input = `
Table users {
  id
  name varchar
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('customers');
    });

    test('should handle malformed DBML - invalid ref syntax', () => {
      const input = `
Table users {
  id int [pk]
}

Table posts {
  user_id int [ref: > ]
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('customers');
    });

    test('should handle table with no columns', () => {
      const input = `
Table users {
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('customers');
    });

    test('should handle unicode table names', () => {
      const input = `
Table "用户" {
  id int [pk]
}

Table posts {
  user_id int [ref: > "用户".id]
}
`;
      const result = renameTable({
        table: '用户',
      }, {
        table: '客户',
      }, input);
      expect(result).toContain('"客户"');
      expect(result).not.toContain('"用户"');
    });

    test('should handle table name with numbers', () => {
      const input = `
Table users2024 {
  id int [pk]
}
`;
      const result = renameTable({
        table: 'users2024',
      }, {
        table: 'customers2024',
      }, input);
      expect(result).toContain('customers2024');
      expect(result).not.toContain('users2024');
    });

    test('should handle self-referencing table', () => {
      const input = `
Table employees {
  id int [pk]
  manager_id int [ref: > employees.id]
}
`;
      const result = renameTable({
        table: 'employees',
      }, {
        table: 'staff',
      }, input);
      expect(result).toContain('Table staff');
      expect(result).toContain('staff.id');
      expect(result).not.toContain('employees');
    });

    test('should handle table with multiple self-references', () => {
      const input = `
Table categories {
  id int [pk]
  parent_id int [ref: > categories.id]
  root_id int [ref: > categories.id]
}
`;
      const result = renameTable({
        table: 'categories',
      }, {
        table: 'groups',
      }, input);
      expect(result).toContain('Table groups');
      const groupRefs = result.match(/groups\.id/g);
      expect(groupRefs).toHaveLength(2);
    });

    test('should handle very long table name', () => {
      const longName = 'a'.repeat(100);
      const newLongName = 'b'.repeat(100);
      const input = `Table ${longName} { id int [pk] }`;
      const result = renameTable({
        table: longName,
      }, {
        table: newLongName,
      }, input);
      expect(result).toContain(newLongName);
      expect(result).not.toContain(longName);
    });

    test('should handle table name that is substring of another', () => {
      const input = `
Table user {
  id int [pk]
}

Table users {
  id int [pk]
  user_id int [ref: > user.id]
}

Table user_profiles {
  id int [pk]
  user_id int [ref: > user.id]
}
`;
      const result = renameTable({
        table: 'user',
      }, {
        table: 'account',
      }, input);
      expect(result).toContain('Table account');
      expect(result).toContain('Table users');
      expect(result).toContain('Table user_profiles');
      expect(result).toContain('account.id');
    });

    test('should handle empty table name in rename request', () => {
      const input = `
Table users {
  id int [pk]
}
`;
      const result = renameTable({
        table: '',
      }, {
        table: 'customers',
      }, input);
      expect(result).toBe(input);
    });

    test('should handle empty new name in rename request', () => {
      const input = `
Table users {
  id int [pk]
}
`;
      // Empty new name is not a valid identifier, so it gets quoted
      const result = renameTable({
        table: 'users',
      }, {
        table: '',
      }, input);
      expect(result).toContain('Table ""');
    });

    test('should handle DBML with enum references', () => {
      const input = `
Enum status {
  active
  inactive
}

Table users {
  id int [pk]
  status status
}

Table posts {
  id int [pk]
  author_id int [ref: > users.id]
  status status
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('Table customers');
      expect(result).toContain('customers.id');
      expect(result).toContain('Enum status');
    });

    test('should handle multiple tables with similar prefixes', () => {
      const input = `
Table user {
  id int [pk]
}

Table user_role {
  id int [pk]
  user_id int [ref: > user.id]
}

Table user_permission {
  id int [pk]
  user_id int [ref: > user.id]
}
`;
      const result = renameTable({
        table: 'user',
      }, {
        table: 'account',
      }, input);
      expect(result).toContain('Table account {');
      expect(result).toContain('Table user_role {');
      expect(result).toContain('Table user_permission {');
      expect(result).toContain('> account.id');
    });

    test('should handle DBML with project block', () => {
      const input = `
Project my_project {
  database_type: 'PostgreSQL'
  Note: 'My project'
}

Table users {
  id int [pk]
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('Project my_project');
      expect(result).toContain('Table customers');
    });

    test('should handle inline ref with composite key', () => {
      const input = `
Table users {
  id int [pk]
  org_id int [pk]
}

Table posts {
  id int [pk]
  user_id int
  org_id int

  indexes {
    (user_id, org_id) [ref: > users.(id, org_id)]
  }
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('Table customers');
    });

    test('should handle note blocks', () => {
      const input = `
Table users {
  id int [pk]

  Note: '''
    This is a multi-line note
    about the users table
  '''
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('Table customers');
      expect(result).toContain('about the users table');
    });

    test('should preserve formatting and whitespace', () => {
      const input = `Table users {
  id    int    [pk]
  name  varchar(255)
}`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('  id    int    [pk]');
      expect(result).toContain('  name  varchar(255)');
    });

    test('should handle table name with dot in quoted identifier', () => {
      const input = `
Table "my.users" {
  id int [pk]
}

Table posts {
  user_id int [ref: > "my.users".id]
}
`;
      const result = renameTable({
        table: 'my.users',
      }, {
        table: 'my.customers',
      }, input);
      expect(result).toContain('"my.customers"');
      expect(result).not.toContain('"my.users"');
    });

    test('should handle schema and table both with dots in quoted identifiers', () => {
      const input = `
Table "my.schema"."my.users" {
  id int [pk]
}

Table posts {
  user_id int [ref: > "my.schema"."my.users".id]
}
`;
      const result = renameTable(
        {
          schema: 'my.schema',
          table: 'my.users',
        },
        {
          schema: 'my.schema',
          table: 'my.customers',
        },
        input,
      );
      expect(result).toContain('"my.customers"');
      expect(result).not.toContain('"my.users"');
    });

    test('should handle table name with multiple dots in quoted identifier', () => {
      const input = `
Table "my.special.users" {
  id int [pk]
}
`;
      const result = renameTable(
        {
          table: 'my.special.users',
        },
        {
          table: 'my.special.customers',
        },
        input,
      );
      expect(result).toContain('"my.special.customers"');
      expect(result).not.toContain('"my.special.users"');
    });

    test('should handle table name starting with digit (requires quotes)', () => {
      const input = `
Table users {
  id int [pk]
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: '2024_users',
      }, input);
      expect(result).toContain('"2024_users"');
    });

    test('should handle renaming from digit-starting name to valid identifier', () => {
      const input = `
Table "2024_users" {
  id int [pk]
}

Table posts {
  user_id int [ref: > "2024_users".id]
}
`;
      const result = renameTable({
        table: '2024_users',
      }, {
        table: 'users',
      }, input);
      expect(result).toContain('Table "users"');
      expect(result).toContain('"users".id');
    });

    test('should handle table name with special characters in schema', () => {
      const input = `
Table "my-schema".users {
  id int [pk]
}
`;
      const result = renameTable(
        {
          schema: 'my-schema',
          table: 'users',
        },
        {
          schema: 'my-schema',
          table: 'customers',
        },
        input,
      );
      expect(result).toContain('customers');
      expect(result).not.toContain('Table "my-schema".users');
    });

    test('should handle whitespace around dot in qualified names', () => {
      const input = `
Table public.users {
  id int [pk]
}

Table posts {
  user_id int [ref: > public . users.id]
}
`;
      const result = renameTable(
        {
          schema: 'public',
          table: 'users',
        },
        {
          schema: 'public',
          table: 'customers',
        },
        input,
      );
      expect(result).toContain('customers');
    });

    test('should handle consecutive renames', () => {
      let input = `
Table users {
  id int [pk]
}

Table posts {
  user_id int [ref: > users.id]
}
`;
      // First rename
      let result = renameTable({
        table: 'users',
      }, {
        table: 'accounts',
      }, input);
      expect(result).toContain('Table accounts');
      expect(result).toContain('accounts.id');

      // Simulate second rename by using the result
      input = result;
      result = renameTable({
        table: 'accounts',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('Table customers');
      expect(result).toContain('customers.id');
    });

    test('should handle table referenced in multiple ref types', () => {
      const input = `
Table users {
  id int [pk]
}

Table posts {
  id int [pk]
  user_id int
}

Ref: posts.user_id > users.id
Ref many_to_many: posts.id <> users.id
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('customers');
      const customerRefs = result.match(/customers\.id/g);
      expect(customerRefs?.length).toBeGreaterThanOrEqual(2);
    });

    test('should handle table in Note field correctly (not rename)', () => {
      const input = `
Table users {
  id int [pk]
  Note: 'This users table stores user data'
}
`;
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('Table customers');
      expect(result).toContain('This users table stores');
    });

    test('should handle table name that is SQL keyword', () => {
      const input = `
Table "select" {
  id int [pk]
}

Table posts {
  select_id int [ref: > "select".id]
}
`;
      const result = renameTable({
        table: 'select',
      }, {
        table: 'chosen',
      }, input);
      expect(result).toContain('"chosen"');
      expect(result).not.toContain('"select"');
    });

    test('should handle case sensitivity in table names', () => {
      const input = `
Table Users {
  id int [pk]
}

Table posts {
  user_id int [ref: > Users.id]
}
`;
      const result = renameTable({
        table: 'Users',
      }, {
        table: 'Customers',
      }, input);
      expect(result).toContain('Table Customers');
      expect(result).toContain('Customers.id');
      expect(result).not.toContain('Table Users');
    });

    test('should not rename if old name case does not match', () => {
      const input = `
Table Users {
  id int [pk]
}
`;
      // Trying to rename 'users' (lowercase) when table is 'Users' (capitalized)
      const result = renameTable({
        table: 'users',
      }, {
        table: 'customers',
      }, input);
      expect(result).toContain('Table Users');
      expect(result).not.toContain('customers');
    });
  });
});


describe('[example] renameTable cross-file', () => {
  function makeMultifileCompiler (files: Record<string, string>): {
    compiler: Compiler;
    fps: Record<string, Filepath>;
  } {
    const compiler = new Compiler();
    const fps: Record<string, Filepath> = {};
    for (const [path, src] of Object.entries(files)) {
      const fp = Filepath.from(path);
      fps[path] = fp;
      compiler.setSource(fp, src);
    }
    return { compiler, fps };
  }

  test('renaming a table updates declaration and same-file references', () => {
    // The table 'users' is defined in base.dbml and has a self-referencing FK
    const base = `
Table users {
  id int [pk]
  manager_id int [ref: > users.id]
}
`;
    const compiler = new Compiler();

    const fp = Filepath.from('/base.dbml');
    compiler.setSource(fp, base);

    const result = compiler.renameTable(fp, 'users', 'accounts').getSource(fp)!;
    expect(result).toContain('Table accounts');
    expect(result).toContain('accounts.id');  // ref updated
    expect(result).not.toContain('users');
  });

  test('renaming the table from the consumer file cascades to both files', () => {
    // base.dbml defines 'users'; consumer.dbml imports it (no alias) and adds a ref.
    // Cross-file rename: invoking renameTable through the consumer's UseSymbol
    // resolves to the original declaration and rewrites every file that touches it.
    const { compiler, fps } = makeMultifileCompiler({
      '/base.dbml': 'Table users { id int [pk] }',
      '/consumer.dbml': `use { table users } from './base.dbml'\nTable orders { user_id int [ref: > users.id] }`,
    });

    const layout = compiler.renameTable(fps['/consumer.dbml'], 'users', 'accounts');
    const baseAfter = layout.getSource(fps['/base.dbml'])!;
    const consumerAfter = layout.getSource(fps['/consumer.dbml'])!;

    expect(baseAfter).toContain('Table accounts');
    expect(baseAfter).not.toContain('Table users');
    expect(consumerAfter).toContain('use { table accounts }');
    expect(consumerAfter).toContain('ref: > accounts.id');
    expect(consumerAfter).not.toContain('users');
  });

  test('renaming a table in the declaring file updates declaration, inline refs, and importers', () => {
    const { compiler, fps } = makeMultifileCompiler({
      '/base.dbml': `
Table users {
  id int [pk]
}

Table posts {
  user_id int [ref: > users.id]
}
`,
      '/main.dbml': `use { table users } from './base.dbml'\nTable orders { user_id int [ref: > users.id] }`,
    });

    const layout = compiler.renameTable(fps['/base.dbml'], 'users', 'accounts');
    const baseAfter = layout.getSource(fps['/base.dbml'])!;
    const mainAfter = layout.getSource(fps['/main.dbml'])!;

    expect(baseAfter).toContain('Table accounts');
    expect(baseAfter).toContain('accounts.id');   // ref in same file updated
    expect(baseAfter).not.toContain('Table users');

    // Cascade reaches the importer: both the use specifier and the inline ref are rewritten.
    expect(mainAfter).toContain('use { table accounts }');
    expect(mainAfter).toContain('ref: > accounts.id');
    expect(mainAfter).not.toContain('users');
  });

  test('renaming a table that does not exist returns source unchanged', () => {
    const source = 'Table users { id int [pk] }';
    const compiler = new Compiler();

    const fp = Filepath.from('/main.dbml');
    compiler.setSource(fp, source);

    const result = compiler.renameTable(fp, 'nonexistent', 'other').getSource(fp)!;
    expect(result).toBe(source);
  });

  test('renaming to a colliding name in same file is a no-op', () => {
    const source = `
Table users { id int [pk] }
Table accounts { id int [pk] }
`;
    const compiler = new Compiler();

    const fp = Filepath.from('/main.dbml');
    compiler.setSource(fp, source);

    const result = compiler.renameTable(fp, 'users', 'accounts').getSource(fp)!;
    expect(result).toBe(source);  // unchanged — collision detected
  });

  test('renaming with schema qualification updates schema-qualified references', () => {
    const source = `
Table auth.users {
  id int [pk]
}

Table posts {
  user_id int [ref: > auth.users.id]
}
`;
    const compiler = new Compiler();

    const fp = Filepath.from('/main.dbml');
    compiler.setSource(fp, source);

    const result = compiler.renameTable(fp, 'auth.users', 'auth.members').getSource(fp)!;
    expect(result).toContain('auth.members');
    expect(result).toContain('auth.members.id');
    expect(result).not.toContain('auth.users');
  });

  test('renaming an alias only rewrites the alias-introducing file', () => {
    const { compiler, fps } = makeMultifileCompiler({
      '/base.dbml': 'Table users { id int [pk] }',
      '/main.dbml': `use { table users as u } from './base.dbml'\nTable orders { user_id int [ref: > u.id] }`,
    });

    const layout = compiler.renameTable(fps['/main.dbml'], 'u', 'member');
    const baseAfter = layout.getSource(fps['/base.dbml'])!;
    const mainAfter = layout.getSource(fps['/main.dbml'])!;

    // Original declaration left alone — alias rename never touches the source file.
    expect(baseAfter).toBe('Table users { id int [pk] }');
    expect(mainAfter).toContain('use { table users as member }');
    expect(mainAfter).toContain('ref: > member.id');
    expect(mainAfter).not.toContain(' u.');
    expect(mainAfter).not.toContain(' u ');
  });

  test('renaming the source name from the alias-introducing file is a lookup miss', () => {
    // Only the alias 'u' is visible in main.dbml — 'users' is not in scope there.
    const { compiler, fps } = makeMultifileCompiler({
      '/base.dbml': 'Table users { id int [pk] }',
      '/main.dbml': `use { table users as u } from './base.dbml'\nTable orders { user_id int [ref: > u.id] }`,
    });

    const layout = compiler.renameTable(fps['/main.dbml'], 'users', 'accounts');
    expect(layout.getSource(fps['/base.dbml'])).toBe('Table users { id int [pk] }');
    expect(layout.getSource(fps['/main.dbml'])).toBe(compiler.layout.getSource(fps['/main.dbml']));
  });

  test('cross-file rename with alias: source-name token in the use specifier flips, alias stays', () => {
    const { compiler, fps } = makeMultifileCompiler({
      '/base.dbml': 'Table users { id int [pk] }',
      '/main.dbml': `use { table users as u } from './base.dbml'\nTable orders { user_id int [ref: > u.id] }`,
    });

    const layout = compiler.renameTable(fps['/base.dbml'], 'users', 'accounts');
    const mainAfter = layout.getSource(fps['/main.dbml'])!;

    // The source-side token gets the new name; the local alias `u` is preserved
    // because alias-side refs do not resolve to the original symbol.
    expect(mainAfter).toContain('use { table accounts as u }');
    expect(mainAfter).toContain('ref: > u.id');
  });
});
