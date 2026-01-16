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
    expect(errors[0].diagnostic).toBe("Foreign key not found: value for column 'user_id' does not exist in referenced table 'users'");
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
    expect(errors[0].diagnostic).toBe("Foreign key not found: value for column 'user_id' does not exist in referenced table 'users'");
    expect(errors[1].diagnostic).toBe("Foreign key not found: value for column 'id' does not exist in referenced table 'user_profiles'");
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
    expect(errors[0].diagnostic).toBe("Foreign key not found: value for column 'dept_id' does not exist in referenced table 'departments'");
  });

  test('should accept valid string FK values', () => {
    const source = `
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      Table cities {
        id int [pk]
        country_code varchar(2)
        name varchar
      }
      Ref: cities.country_code > countries.code

      records countries(code, name) {
        "US", "United States"
        "UK", "United Kingdom"
      }
      records cities(id, country_code, name) {
        1, "US", "New York"
        2, "UK", "London"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[1].values[0][1]).toEqual({ type: 'string', value: 'US' });
    expect(db.records[1].values[1][1]).toEqual({ type: 'string', value: 'UK' });
  });

  test('should reject invalid string FK values', () => {
    const source = `
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      Table cities {
        id int [pk]
        country_code varchar(2)
        name varchar
      }
      Ref: cities.country_code > countries.code

      records countries(code, name) {
        "US", "United States"
      }
      records cities(id, country_code, name) {
        1, "US", "New York"
        2, "FR", "Paris"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Foreign key not found: value for column 'country_code' does not exist in referenced table 'countries'");
  });

  test('should validate FK with zero values', () => {
    const source = `
      Table items {
        id int [pk]
        name varchar
      }
      Table orders {
        id int [pk]
        item_id int
      }
      Ref: orders.item_id > items.id

      records items(id, name) {
        0, "Default Item"
        1, "Item One"
      }
      records orders(id, item_id) {
        1, 0
        2, 1
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should validate FK with negative values', () => {
    const source = `
      Table accounts {
        id int [pk]
        name varchar
      }
      Table transactions {
        id int [pk]
        account_id int
        amount decimal
      }
      Ref: transactions.account_id > accounts.id

      records accounts(id, name) {
        -1, "System Account"
        1, "User Account"
      }
      records transactions(id, account_id, amount) {
        1, -1, 100.00
        2, 1, 50.00
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should validate FK across multiple records blocks', () => {
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
      records users(id, name) {
        2, "Bob"
      }
      records posts(id, user_id, title) {
        1, 1, "Alice's Post"
      }
      records posts(id, user_id, title) {
        2, 2, "Bob's Post"
        3, 3, "Invalid Post"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Foreign key not found: value for column 'user_id' does not exist in referenced table 'users'");
  });

  test('should accept inline ref syntax for FK', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int [ref: > users.id]
        title varchar
      }

      records users(id, name) {
        1, "Alice"
      }
      records posts(id, user_id, title) {
        1, 1, "Valid Post"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should reject invalid inline ref FK value', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int [ref: > users.id]
        title varchar
      }

      records users(id, name) {
        1, "Alice"
      }
      records posts(id, user_id, title) {
        1, 1, "Valid Post"
        2, 999, "Invalid Post"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Foreign key not found: value for column 'user_id' does not exist in referenced table 'users'");
  });

  test('should accept self-referencing FK', () => {
    const source = `
      Table employees {
        id int [pk]
        manager_id int
        name varchar
      }
      Ref: employees.manager_id > employees.id

      records employees(id, manager_id, name) {
        1, null, "CEO"
        2, 1, "Manager"
        3, 2, "Employee"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should reject invalid self-referencing FK', () => {
    const source = `
      Table employees {
        id int [pk]
        manager_id int
        name varchar
      }
      Ref: employees.manager_id > employees.id

      records employees(id, manager_id, name) {
        1, null, "CEO"
        2, 999, "Invalid Manager Reference"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Foreign key not found: value for column 'manager_id' does not exist in referenced table 'employees'");
  });
});
