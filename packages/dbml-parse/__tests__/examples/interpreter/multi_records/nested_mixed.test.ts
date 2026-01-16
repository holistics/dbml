import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

describe('[example - record] nested and top-level records mixed', () => {
  test('should handle records inside table with explicit columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar

        records (id, name) {
          1, 'Alice'
          2, 'Bob'
        }
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].columns).toEqual(['id', 'name']);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should handle records inside table without explicit columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar

        records {
          1, 'Alice', 'alice@example.com'
          2, 'Bob', 'bob@example.com'
        }
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].columns).toEqual(['id', 'name', 'email']);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should mix nested and top-level records for same table', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar

        records (id, name) {
          1, 'Alice'
        }
      }

      records users(id, email) {
        2, 'bob@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // All records for the same table should be merged into one TableRecord
    expect(db.records.length).toBe(1);

    const record = db.records[0];
    // Columns should include all unique columns from all record blocks
    expect(record.columns).toContain('id');
    expect(record.columns).toContain('name');
    expect(record.columns).toContain('email');

    // Should have 2 data rows (array-based)
    expect(record.values).toHaveLength(2);

    // First row has id and name
    // columns order varies, but should contain id, name, email
    const idIndex = record.columns.indexOf('id');
    const nameIndex = record.columns.indexOf('name');
    const emailIndex = record.columns.indexOf('email');

    expect(record.values[0][idIndex]).toBeDefined();
    expect(record.values[0][nameIndex]).toBeDefined();

    // Second row has id and email
    expect(record.values[1][idIndex]).toBeDefined();
    expect(record.values[1][emailIndex]).toBeDefined();
  });

  test('should merge multiple nested records blocks with same columns', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal

        records (id, name) {
          1, 'Laptop'
        }

        records (id, name) {
          2, 'Mouse'
        }
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should merge nested records blocks with different columns', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal

        records (id, name) {
          1, 'Laptop'
        }

        records (id, price) {
          2, 999.99
        }
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // All records for the same table are merged into one
    expect(db.records.length).toBe(1);

    const record = db.records[0];
    // All unique columns should be present
    expect(record.columns).toContain('id');
    expect(record.columns).toContain('name');
    expect(record.columns).toContain('price');

    // 2 rows, each with different columns populated
    expect(record.values).toHaveLength(2);
  });

  test('should handle complex mix of nested, top-level, with and without columns', () => {
    const source = `
      Table orders {
        id int [pk]
        user_id int
        total decimal
        status varchar

        records (id, user_id) {
          1, 100
        }

        records {
          2, 101, 250.50, 'pending'
        }
      }

      records orders(id, total) {
        3, 500.00
      }

      records orders(id, status) {
        4, 'completed'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // All records for orders table merged into one
    expect(db.records.length).toBe(1);

    const record = db.records[0];
    // All columns should be present
    expect(record.columns).toContain('id');
    expect(record.columns).toContain('user_id');
    expect(record.columns).toContain('total');
    expect(record.columns).toContain('status');

    // 4 data rows total
    expect(record.values).toHaveLength(4);
  });

  test('should validate PK across nested and top-level records', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar

        records (id, name) {
          1, 'Alice'
        }
      }

      records users(id, name) {
        1, 'Bob'  // Duplicate PK
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(errors[0].diagnostic).toContain('Duplicate primary key');
  });

  test('should validate unique across nested and top-level records', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        name varchar

        records (id, email) {
          1, 'alice@example.com'
        }
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
});
