import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

describe('[example - record] Unique validation across multiple records blocks', () => {
  test('should validate unique constraint across blocks with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
      }

      records users(id, email) {
        1, 'alice@example.com'
        2, 'bob@example.com'
      }

      records users(id, username) {
        3, 'charlie'
        4, 'david'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);
  });

  test('should detect unique violation across blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        name varchar
      }

      records users(id, email) {
        1, 'alice@example.com'
      }

      records users(id, email, name) {
        2, 'alice@example.com', 'Alice2'  // Duplicate email
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(errors[0].diagnostic).toContain('Duplicate unique value');
  });

  test('should validate composite unique across multiple blocks', () => {
    const source = `
      Table user_roles {
        id int [pk]
        user_id int
        role_id int
        granted_by int
        indexes {
          (user_id, role_id) [unique]
        }
      }

      records user_roles(id, user_id, role_id) {
        1, 100, 1
        2, 100, 2
      }

      records user_roles(id, user_id, role_id, granted_by) {
        3, 101, 1, 999
        4, 102, 1, 999
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);
  });

  test('should detect composite unique violation across blocks', () => {
    const source = `
      Table user_roles {
        id int [pk]
        user_id int
        role_id int
        indexes {
          (user_id, role_id) [unique]
        }
      }

      records user_roles(id, user_id, role_id) {
        1, 100, 1
      }

      records user_roles(id, user_id, role_id) {
        2, 100, 1  // Duplicate (100, 1)
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toContain('Duplicate composite unique');
  });

  test('should allow NULL for unique constraint across blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        phone varchar [unique]
      }

      records users(id, email) {
        1, null
        2, null  // Multiple NULLs allowed
      }

      records users(id, phone) {
        3, null
        4, null  // Multiple NULLs allowed
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);
  });

  test('should handle unique when column missing from some blocks', () => {
    const source = `
      Table products {
        id int [pk]
        sku varchar [unique]
        name varchar
        description text
      }

      records products(id, name) {
        1, 'Product A'  // sku missing, implicitly NULL
      }

      records products(id, sku) {
        2, 'SKU-001'
        3, 'SKU-002'
      }

      records products(id, description) {
        4, 'Description text'  // sku missing, implicitly NULL
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);
  });

  test('should validate multiple unique constraints on same table across blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
        phone varchar [unique]
      }

      records users(id, email, username) {
        1, 'alice@example.com', 'alice'
      }

      records users(id, phone) {
        2, '555-0001'
      }

      records users(id, email) {
        3, 'bob@example.com'
      }

      records users(id, username, phone) {
        4, 'charlie', '555-0002'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);
  });

  test('should detect violations of different unique constraints', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
      }

      records users(id, email) {
        1, 'alice@example.com'
      }

      records users(id, username) {
        2, 'bob'
      }

      records users(id, email, username) {
        3, 'alice@example.com', 'charlie'  // Duplicate email
        4, 'david@example.com', 'bob'       // Duplicate username
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(2);
    expect(errors.some((e) => e.diagnostic.includes('email'))).toBe(true);
    expect(errors.some((e) => e.diagnostic.includes('username'))).toBe(true);
  });

  test('should validate unique across nested and top-level records', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar

        records (id, email) {
          1, 'alice@example.com'
        }
      }

      records users(id, username) {
        2, 'bob'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);
  });

  test('should detect unique violation between nested and top-level', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]

        records (id, email) {
          1, 'alice@example.com'
        }
      }

      records users(id, email) {
        2, 'alice@example.com'  // Duplicate
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toContain('Duplicate unique value');
  });

  test('should handle complex scenario with multiple unique constraints', () => {
    const source = `
      Table employees {
        id int [pk]
        email varchar [unique]
        employee_code varchar [unique]
        ssn varchar [unique]
        name varchar
      }

      records employees(id, email, employee_code) {
        1, 'emp1@company.com', 'EMP001'
      }

      records employees(id, ssn) {
        2, '123-45-6789'
      }

      records employees(id, email, ssn) {
        3, 'emp3@company.com', '987-65-4321'
      }

      records employees(id, employee_code, name) {
        4, 'EMP004', 'John Doe'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);
  });

  test('should detect multiple unique violations in complex scenario', () => {
    const source = `
      Table products {
        id int [pk]
        sku varchar [unique]
        barcode varchar [unique]
        name varchar
      }

      records products(id, sku, barcode) {
        1, 'SKU-001', 'BAR-001'
      }

      records products(id, sku) {
        2, 'SKU-002'
      }

      records products(id, sku, name) {
        3, 'SKU-001', 'Product 3'  // Duplicate SKU
      }

      records products(id, barcode) {
        4, 'BAR-001'  // Duplicate barcode
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(2);
    expect(errors[0].diagnostic).toContain('Duplicate unique value');
    expect(errors[1].diagnostic).toContain('Duplicate unique value');
  });

  test('should validate unique with both PK and unique constraints', () => {
    const source = `
      Table users {
        id int [pk, unique]  // Both PK and unique
        email varchar [unique]
      }

      records users(id) {
        1
      }

      records users(id, email) {
        2, 'alice@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);
  });
});
