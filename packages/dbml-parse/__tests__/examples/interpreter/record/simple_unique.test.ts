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
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'alice@example.com' });

    // Row 2: id=2, email="bob@example.com"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'bob@example.com' });

    // Row 3: id=3, email="charlie@example.com"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: 'charlie@example.com' });
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
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: null });

    // Row 2: id=2, phone=null
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: '' });

    // Row 3: id=3, phone="555-1234"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: '555-1234' });

    // Row 4: id=4, phone=null
    expect(db.records[0].values[3][0]).toEqual({ type: 'integer', value: 4 });
    expect(db.records[0].values[3][1]).toEqual({ type: 'string', value: null });
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
});
