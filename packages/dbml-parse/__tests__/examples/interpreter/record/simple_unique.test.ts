import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example - record] simple unique constraints', () => {
  test('should accept valid unique values', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }
      records users(id, email) {
        1, "alice@example.com"
        2, "bob@example.com"
        3, "charlie@example.com"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('users');
    expect(db.records[0].columns).toEqual(['id', 'email']);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: id=1, email="alice@example.com"
    expect(db.records[0].values[0].id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].email).toEqual({ type: 'string', value: 'alice@example.com' });

    // Row 2: id=2, email="bob@example.com"
    expect(db.records[0].values[1].id).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1].email).toEqual({ type: 'string', value: 'bob@example.com' });

    // Row 3: id=3, email="charlie@example.com"
    expect(db.records[0].values[2].id).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2].email).toEqual({ type: 'string', value: 'charlie@example.com' });
  });

  test('should reject duplicate unique values', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }
      records users(id, email) {
        1, "alice@example.com"
        2, "alice@example.com"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Duplicate unique value for column 'email'");
  });

  test('should allow NULL values in unique column (NULLs dont conflict)', () => {
    const source = `
      Table users {
        id int [pk]
        phone varchar [unique]
      }
      records users(id, phone) {
        1, null
        2, ""
        3, "555-1234"
        4,
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values.length).toBe(4);

    // Row 1: id=1, phone=null
    expect(db.records[0].values[0].id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].phone).toEqual({ type: 'string', value: null });

    // Row 2: id=2, phone=null
    expect(db.records[0].values[1].id).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1].phone).toEqual({ type: 'string', value: '' });

    // Row 3: id=3, phone="555-1234"
    expect(db.records[0].values[2].id).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2].phone).toEqual({ type: 'string', value: '555-1234' });

    // Row 4: id=4, phone=null
    expect(db.records[0].values[3].id).toEqual({ type: 'integer', value: 4 });
    expect(db.records[0].values[3].phone).toEqual({ type: 'string', value: null });
  });

  test('should detect duplicate unique across multiple records blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }
      records users(id, email) {
        1, "alice@example.com"
      }
      records users(id, email) {
        2, "alice@example.com"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Duplicate unique value for column 'email'");
  });

  test('should validate multiple unique columns independently', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
      }
      records users(id, email, username) {
        1, "alice@example.com", "alice"
        2, "bob@example.com", "alice"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Duplicate unique value for column 'username'");
  });

  test('should accept unique constraint with numeric values', () => {
    const source = `
      Table products {
        id int [pk]
        sku int [unique]
        name varchar
      }
      records products(id, sku, name) {
        1, 1001, "Product A"
        2, 1002, "Product B"
        3, 1003, "Product C"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0].sku).toEqual({ type: 'integer', value: 1001 });
    expect(db.records[0].values[1].sku).toEqual({ type: 'integer', value: 1002 });
    expect(db.records[0].values[2].sku).toEqual({ type: 'integer', value: 1003 });
  });

  test('should reject duplicate numeric unique values', () => {
    const source = `
      Table products {
        id int [pk]
        sku int [unique]
        name varchar
      }
      records products(id, sku, name) {
        1, 1001, "Product A"
        2, 1001, "Product B"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Duplicate unique value for column 'sku'");
  });

  test('should accept zero as unique value', () => {
    const source = `
      Table items {
        id int [pk]
        code int [unique]
      }
      records items(id, code) {
        1, 0
        2, 1
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should handle negative numbers in unique constraint', () => {
    const source = `
      Table balances {
        id int [pk]
        account_num int [unique]
      }
      records balances(id, account_num) {
        1, -100
        2, 100
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0].account_num).toEqual({ type: 'integer', value: -100 });
    expect(db.records[0].values[1].account_num).toEqual({ type: 'integer', value: 100 });
  });

  test('should accept both pk and unique on same column', () => {
    const source = `
      Table items {
        id int [pk, unique]
        name varchar
      }
      records items(id, name) {
        1, "Item 1"
        2, "Item 2"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should reject duplicate when column has both pk and unique', () => {
    const source = `
      Table items {
        id int [pk, unique]
        name varchar
      }
      records items(id, name) {
        1, "Item 1"
        1, "Item 2"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // Both pk and unique violations are reported
    expect(errors.length).toBe(2);
    expect(errors[0].diagnostic).toBe("Duplicate primary key value for column 'id'");
    expect(errors[1].diagnostic).toBe("Duplicate unique value for column 'id'");
  });

  test('should allow all null values in unique column', () => {
    const source = `
      Table data {
        id int [pk]
        optional_code varchar [unique]
      }
      records data(id, optional_code) {
        1, null
        2, null
        3, null
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });
});
