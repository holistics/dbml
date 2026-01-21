import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

describe('[example - record] FK validation across multiple records blocks', () => {
  test('should validate FK across records blocks with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }

      Table orders {
        id int [pk]
        user_id int [ref: > users.id]
        total decimal
      }

      records users(id, name) {
        1, 'Alice'
      }

      records users(id) {
        2
      }

      records orders(id, user_id) {
        100, 1  // Valid: user 1 exists
      }

      records orders(id, user_id, total) {
        101, 2, 250.00  // Valid: user 2 exists
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect FK violation when referenced value not in any records block', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar
      }

      Table orders {
        id int [pk]
        user_id int [ref: > users.id]
      }

      records users(id, name) {
        1, 'Alice'
      }

      records users(id, email) {
        2, 'bob@example.com'
      }

      records orders(id, user_id) {
        100, 3  // Invalid: user 3 doesn't exist in any block
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('FK violation');
  });

  test('should validate composite FK across multiple records blocks', () => {
    const source = `
      Table users {
        tenant_id int
        user_id int
        name varchar
        indexes {
          (tenant_id, user_id) [pk]
        }
      }

      Table posts {
        id int [pk]
        tenant_id int
        author_id int
      }

      Ref: posts.(tenant_id, author_id) > users.(tenant_id, user_id)

      records users(tenant_id, user_id) {
        1, 100
      }

      records users(tenant_id, user_id, name) {
        1, 101, 'Bob'
        2, 200, 'Charlie'
      }

      records posts(id, tenant_id, author_id) {
        1, 1, 100  // Valid: (1, 100) exists
        2, 1, 101  // Valid: (1, 101) exists
        3, 2, 200  // Valid: (2, 200) exists
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect composite FK violation across blocks', () => {
    const source = `
      Table users {
        tenant_id int
        user_id int
        email varchar
        indexes {
          (tenant_id, user_id) [pk]
        }
      }

      Table posts {
        id int [pk]
        tenant_id int
        author_id int
      }

      Ref: posts.(tenant_id, author_id) > users.(tenant_id, user_id)

      records users(tenant_id, user_id) {
        1, 100
      }

      records users(tenant_id, user_id, email) {
        2, 200, 'user@example.com'
      }

      records posts(id, tenant_id, author_id) {
        1, 1, 101  // Invalid: (1, 101) doesn't exist
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(2);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('FK violation');
    expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[1].diagnostic).toContain('FK violation');
  });

  test('should handle FK when referenced column appears in some but not all blocks', () => {
    const source = `
      Table categories {
        id int [pk]
        name varchar
        description text
      }

      Table products {
        id int [pk]
        category_id int [ref: > categories.id]
        name varchar
      }

      // Block 1: has id but not category_id
      records categories(id, name) {
        1, 'Electronics'
      }

      // Block 2: has different columns
      records categories(id, description) {
        2, 'Category 2 description'
      }

      // Block 3: has id again
      records categories(id, name) {
        3, 'Home'
      }

      records products(id, category_id, name) {
        100, 1, 'Laptop'
        101, 2, 'Mouse'
        102, 3, 'Chair'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should validate FK with NULL values across blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }

      Table orders {
        id int [pk]
        user_id int [ref: > users.id]
        notes varchar
      }

      records users(id, name) {
        1, 'Alice'
      }

      records orders(id, user_id) {
        100, 1       // Valid
        101, null    // Valid: NULL FK allowed
      }

      records orders(id, notes) {
        102, 'No user'  // Valid: user_id implicitly NULL
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should validate bidirectional FK (1-1) across multiple blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }

      Table profiles {
        id int [pk]
        user_id int [unique]
      }

      Ref: users.id <> profiles.user_id

      records users(id) {
        1
      }

      records users(id, name) {
        2, 'Bob'
      }

      records profiles(id, user_id) {
        10, 1
        11, 2
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect bidirectional FK violation', () => {
    const source = `
      Table users {
        id int [pk]
      }

      Table profiles {
        id int [pk]
        user_id int [unique]
      }

      Ref: users.id <> profiles.user_id

      records users(id) {
        1
      }

      records profiles(id, user_id) {
        10, 1
        11, 3  // Invalid: user 3 doesn't exist
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((e) => e.diagnostic.includes('FK violation'))).toBe(true);
  });

  test('should validate FK across nested and top-level records', () => {
    const source = `
      Table categories {
        id int [pk]
        name varchar

        records (id) {
          1
        }
      }

      records categories(id, name) {
        2, 'Electronics'
      }

      Table products {
        id int [pk]
        category_id int [ref: > categories.id]

        records (id, category_id) {
          100, 1  // References nested record
        }
      }

      records products(id, category_id) {
        101, 2  // References top-level record
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });
});
