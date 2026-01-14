import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example - record] simple primary key constraints', () => {
  test('should accept valid unique primary key values', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        2, "Bob"
        3, "Charlie"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('users');
    expect(db.records[0].columns).toEqual(['id', 'name']);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: id=1, name="Alice"
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Alice' });

    // Row 2: id=2, name="Bob"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Row 3: id=3, name="Charlie"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: 'Charlie' });
  });

  test('should reject duplicate primary key values', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        1, "Bob"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Duplicate primary key value for column 'id'");
  });

  test('should reject NULL values in primary key column', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        null, "Alice"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("NULL value not allowed in primary key column 'id'");
  });

  test('should detect duplicate pk across multiple records blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
      }
      records users(id, name) {
        1, "Bob"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Duplicate primary key value for column 'id'");
  });

  test('should report error when pk column is missing from record', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar
      }
      records users(name, email) {
        "Alice", "alice@example.com"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Missing primary key column 'id' in record");
  });
});
