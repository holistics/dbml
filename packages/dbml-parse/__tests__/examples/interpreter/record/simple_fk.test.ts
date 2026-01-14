import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example - record] simple foreign key constraints', () => {
  test('should accept valid many-to-one FK references', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int
        title varchar
      }
      Ref: posts.user_id > users.id

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }
      records posts(id, user_id, title) {
        1, 1, "Alice's Post"
        2, 1, "Another Post"
        3, 2, "Bob's Post"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(2);

    // Users table
    expect(db.records[0].tableName).toBe('users');
    expect(db.records[0].values.length).toBe(2);
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Alice' });
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Posts table
    expect(db.records[1].tableName).toBe('posts');
    expect(db.records[1].values.length).toBe(3);
    expect(db.records[1].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][1]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][2]).toEqual({ type: 'string', value: "Alice's Post" });
  });

  test('should reject FK values that dont exist in referenced table', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int
        title varchar
      }
      Ref: posts.user_id > users.id

      records users(id, name) {
        1, "Alice"
      }
      records posts(id, user_id, title) {
        1, 1, "Valid Post"
        2, 999, "Invalid FK"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Foreign key violation: value for column 'user_id' does not exist in referenced table 'users'");
  });

  test('should allow NULL FK values (optional relationship)', () => {
    const source = `
      Table categories {
        id int [pk]
        name varchar
      }
      Table products {
        id int [pk]
        category_id int
        name varchar
      }
      Ref: products.category_id > categories.id

      records categories(id, name) {
        1, "Electronics"
      }
      records products(id, category_id, name) {
        1, 1, "Laptop"
        2, null, "Uncategorized Item"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[1].values.length).toBe(2);

    // Row 1: id=1, category_id=1, name="Laptop"
    expect(db.records[1].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][1]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][2]).toEqual({ type: 'string', value: 'Laptop' });

    // Row 2: id=2, category_id=null, name="Uncategorized Item"
    expect(db.records[1].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[1].values[1][1].value).toBe(null);
    expect(db.records[1].values[1][2]).toEqual({ type: 'string', value: 'Uncategorized Item' });
  });

  test('should validate one-to-one FK both directions', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table user_profiles {
        id int [pk]
        user_id int
        bio text
      }
      Ref: user_profiles.user_id - users.id

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }
      records user_profiles(id, user_id, bio) {
        1, 1, "Alice's bio"
        2, 3, "Invalid user"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // One-to-one validates both directions:
    // 1. user_profiles.user_id=3 doesn't exist in users.id
    // 2. users.id=2 (Bob) doesn't have a matching user_profiles.user_id
    expect(errors.length).toBe(2);
    expect(errors[0].diagnostic).toBe("Foreign key violation: value for column 'user_id' does not exist in referenced table 'users'");
    expect(errors[1].diagnostic).toBe("Foreign key violation: value for column 'id' does not exist in referenced table 'user_profiles'");
  });

  test('should validate one-to-many FK from parent side', () => {
    const source = `
      Table departments {
        id int [pk]
        name varchar
      }
      Table employees {
        id int [pk]
        dept_id int
        name varchar
      }
      Ref: departments.id < employees.dept_id

      records departments(id, name) {
        1, "Engineering"
      }
      records employees(id, dept_id, name) {
        1, 1, "Alice"
        2, 999, "Bob with invalid dept"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Foreign key violation: value for column 'dept_id' does not exist in referenced table 'departments'");
  });
});
