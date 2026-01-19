import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example - record] auto-increment and serial type constraints', () => {
  test('should allow NULL in pk column with increment flag', () => {
    const source = `
      Table users {
        id int [pk, increment]
        name varchar
      }
      records users(id, name) {
        null, "Alice"
        null, "Bob"
        1, "Charlie"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: id=null (auto-generated), name="Alice"
    expect(db.records[0].values[0][0].value).toBe(null);
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Alice' });

    // Row 2: id=null (auto-generated), name="Bob"
    expect(db.records[0].values[1][0].value).toBe(null);
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Row 3: id=1, name="Charlie"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: 'Charlie' });
  });

  test('should allow NULL in pk column with serial type', () => {
    const source = `
      Table users {
        id serial [pk]
        name varchar
      }
      records users(id, name) {
        null, "Alice"
        null, "Bob"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values.length).toBe(2);
  });

  test('should allow NULL in pk column with bigserial type', () => {
    const source = `
      Table users {
        id bigserial [pk]
        name varchar
      }
      records users(id, name) {
        null, "Alice"
        null, "Bob"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should detect duplicate pk for non-null values with increment', () => {
    const source = `
      Table users {
        id int [pk, increment]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        1, "Bob"
        null, "Charlie"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe('Duplicate PK: users.id = 1');
  });

  test('should detect duplicate pk with not null + dbdefault', () => {
    const source = `
      Table users {
        id int [pk, not null, default: 1]
        name varchar
      }
      records users(id, name) {
        null, "Alice"
        null, "Bob"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // Both NULLs resolve to default value 1, which is a duplicate
    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe('Duplicate PK: users.id = null');
  });
});
