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
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('users');
    expect(record.columns).toEqual(['id', 'name']);
    expect(record.values.length).toBe(3);

    // Verify ALL rows and ALL columns in each row
    // Row 1: (null, "Alice") - id is auto-generated
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: null });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'Alice' });

    // Row 2: (null, "Bob") - id is auto-generated
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: null });
    expect(record.values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Row 3: (1, "Charlie")
    expect(record.values[2].length).toBe(2);
    expect(record.values[2][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[2][1]).toEqual({ type: 'string', value: 'Charlie' });
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
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('users');
    expect(record.columns).toEqual(['id', 'name']);
    expect(record.values.length).toBe(2);

    // Verify ALL rows and ALL columns in each row
    // Row 1: (null, "Alice") - id is auto-generated
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: null });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'Alice' });

    // Row 2: (null, "Bob") - id is auto-generated
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: null });
    expect(record.values[1][1]).toEqual({ type: 'string', value: 'Bob' });
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
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('users');
    expect(record.columns).toEqual(['id', 'name']);
    expect(record.values.length).toBe(2);

    // Verify ALL rows and ALL columns in each row
    // Row 1: (null, "Alice") - id is auto-generated
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: null });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'Alice' });

    // Row 2: (null, "Bob") - id is auto-generated
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: null });
    expect(record.values[1][1]).toEqual({ type: 'string', value: 'Bob' });
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
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate PK: users.id = 1');
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
    const warnings = result.getWarnings();

    // Both NULLs resolve to default value 1, which is a duplicate
    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate PK: users.id = null');
  });
});
