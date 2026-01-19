import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

describe('[example - record] PK validation across multiple records blocks', () => {
  test('should validate PK uniqueness across blocks with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar
      }

      records users(id, name) {
        1, 'Alice'
        2, 'Bob'
      }

      records users(id, email) {
        3, 'charlie@example.com'
        4, 'david@example.com'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect PK duplicate across blocks with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar
      }

      records users(id, name) {
        1, 'Alice'
        2, 'Bob'
      }

      records users(id, email) {
        2, 'bob2@example.com'  // Duplicate PK: 2 already exists
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('Duplicate PK');
  });

  test('should validate composite PK across multiple blocks', () => {
    const source = `
      Table order_items {
        order_id int
        product_id int
        quantity int
        price decimal
        indexes {
          (order_id, product_id) [pk]
        }
      }

      records order_items(order_id, product_id, quantity) {
        1, 100, 2
        1, 101, 1
      }

      records order_items(order_id, product_id, price) {
        2, 100, 50.00
        2, 101, 75.00
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect composite PK duplicate across blocks', () => {
    const source = `
      Table order_items {
        order_id int
        product_id int
        quantity int
        indexes {
          (order_id, product_id) [pk]
        }
      }

      records order_items(order_id, product_id, quantity) {
        1, 100, 2
      }

      records order_items(order_id, product_id) {
        1, 100  // Duplicate: (1, 100) already exists
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('Duplicate Composite PK');
  });

  test('should handle PK validation when PK column missing from some blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        bio text
      }

      records users(id, name) {
        1, 'Alice'
      }

      records users(name, bio) {
        'Bob', 'Bio text'  // Missing PK column
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    // With merged records, missing PK column results in undefined/NULL value
    expect(warnings[0].diagnostic).toContain('NULL in PK');
  });

  test('should validate PK with NULL across blocks', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        sku varchar
      }

      records products(id, name) {
        null, 'Product A'  // NULL PK not allowed
      }

      records products(id, sku) {
        1, 'SKU-001'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toContain('NULL in PK');
  });

  test('should allow NULL for auto-increment PK across blocks', () => {
    const source = `
      Table users {
        id int [pk, increment]
        name varchar
        email varchar
      }

      records users(id, name) {
        null, 'Alice'
        null, 'Bob'
      }

      records users(id, email) {
        null, 'charlie@example.com'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect duplicate non-NULL PK with increment', () => {
    const source = `
      Table users {
        id int [pk, increment]
        name varchar
        email varchar
      }

      records users(id, name) {
        1, 'Alice'
      }

      records users(id, email) {
        1, 'alice@example.com'  // Duplicate even with increment
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toContain('Duplicate PK');
  });

  test('should validate PK across nested and top-level records', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal

        records (id, name) {
          1, 'Laptop'
        }
      }

      records products(id, price) {
        2, 999.99
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect PK duplicate between nested and top-level', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar

        records (id) {
          1
        }
      }

      records products(id, name) {
        1, 'Laptop'  // Duplicate
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toContain('Duplicate PK');
  });

  test('should validate complex scenario with multiple blocks and mixed columns', () => {
    const source = `
      Table users {
        id int [pk]
        username varchar
        email varchar
        created_at timestamp
      }

      records users(id, username) {
        1, 'alice'
        2, 'bob'
      }

      records users(id, email) {
        3, 'charlie@example.com'
        4, 'david@example.com'
      }

      records users(id, created_at) {
        5, '2024-01-01'
      }

      records users(id, username, email) {
        6, 'eve', 'eve@example.com'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect multiple PK violations across many blocks', () => {
    const source = `
      Table events {
        id int [pk]
        name varchar
        date varchar
        location varchar
      }

      records events(id, name) {
        1, 'Event A'
        2, 'Event B'
      }

      records events(id, date) {
        2, '2024-01-01'  // Duplicate 1
        3, '2024-01-02'
      }

      records events(id, location) {
        1, 'Location A'  // Duplicate 2
        4, 'Location B'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(2);
    expect(warnings.every((e) => e.diagnostic.includes('Duplicate PK'))).toBe(true);
  });
});
