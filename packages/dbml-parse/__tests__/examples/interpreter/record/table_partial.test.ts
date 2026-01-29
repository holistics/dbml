import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example - record] table partial with records', () => {
  test('should handle records with explicit columns from merged table partial', () => {
    const source = `
      TablePartial Timestamps {
        created_at timestamp
        updated_at timestamp
      }

      Table users {
        ~Timestamps
        id int [pk]
        name varchar
        email varchar
      }

      records users(created_at, updated_at, id, name, email) {
        '2024-01-01 00:00:00+07:00', '2024-01-01 00:00:00+07:00', 1, 'Alice', 'alice@example.com'
        '2024-01-02 00:00:00+07:00', '2024-01-02 00:00:00+07:00', 2, 'Bob', 'bob@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);

    // Explicit columns should match merged field order: created_at, updated_at, id, name, email
    expect(db.records[0].columns).toEqual(['created_at', 'updated_at', 'id', 'name', 'email']);
    expect(db.records[0].values).toHaveLength(2);

    // Check first row values
    expect(db.records[0].values[0][0].value).toBe('2024-01-01T00:00:00.000+07:00');
    expect(db.records[0].values[0][1].value).toBe('2024-01-01T00:00:00.000+07:00');
    expect(db.records[0].values[0][2]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][3]).toEqual({ type: 'string', value: 'Alice' });
    expect(db.records[0].values[0][4]).toEqual({ type: 'string', value: 'alice@example.com' });
  });

  test('should handle records with explicit columns that include partial fields', () => {
    const source = `
      TablePartial BaseFields {
        id int [pk]
        created_at timestamp
      }

      Table products {
        ~BaseFields
        name varchar
        price decimal
      }

      records products(id, name, price) {
        1, 'Widget', 9.99
        2, 'Gadget', 19.99
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].columns).toEqual(['id', 'name', 'price']);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should handle records with partial field override', () => {
    const source = `
      TablePartial WithId {
        id int
        extra varchar
      }

      Table users {
        ~WithId
        id int [pk]
        name varchar
      }

      records users(extra, id, name) {
        'extra_value', 1, 'Alice'
        'extra_value2', 2, 'Bob'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);

    // Field order should be: extra (from partial), id (direct definition overrides partial's id), name
    expect(db.records[0].columns).toEqual(['extra', 'id', 'name']);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should handle records with multiple partial injections', () => {
    const source = `
      TablePartial Base {
        id int [pk]
        created_at timestamp
      }

      TablePartial SoftDelete {
        deleted_at timestamp
        is_deleted boolean
      }

      Table posts {
        ~Base
        title varchar
        content text
        ~SoftDelete
        author_id int
      }

      records posts(id, title, content, author_id) {
        1, 'First Post', 'Hello World', 100
        2, 'Second Post', 'Welcome', 101
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].columns).toEqual(['id', 'title', 'content', 'author_id']);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should handle records with partial at different positions', () => {
    const source = `
      TablePartial Start {
        s1 int
        s2 int
      }

      TablePartial Middle {
        m1 int
        m2 int
      }

      TablePartial End {
        e1 int
        e2 int
      }

      Table T {
        ~Start
        a int [pk]
        b int
        ~Middle
        c int
        d int
        ~End
      }

      records T(s1, s2, a, b, m1, m2, c, d, e1, e2) {
        1, 2, 3, 4, 5, 6, 7, 8, 9, 10
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);

    // Columns should match merged order: s1, s2, a, b, m1, m2, c, d, e1, e2
    expect(db.records[0].columns).toEqual(['s1', 's2', 'a', 'b', 'm1', 'm2', 'c', 'd', 'e1', 'e2']);
    expect(db.records[0].values).toHaveLength(1);
    expect(db.records[0].values[0]).toHaveLength(10);
  });

  test('should handle nested records with explicit columns and partial', () => {
    const source = `
      TablePartial Metadata {
        created_at timestamp
        updated_at timestamp
      }

      Table users {
        ~Metadata
        id int [pk]
        name varchar

        records (created_at, updated_at, id, name) {
          '2024-01-01 00:00:00+07:00', '2024-01-01 00:00:00+07:00', 1, 'Alice'
          '2024-01-02 00:00:00+07:00', '2024-01-02 00:00:00+07:00', 2, 'Bob'
        }
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);

    // Columns should respect merged field order: created_at, updated_at, id, name
    expect(db.records[0].columns).toEqual(['created_at', 'updated_at', 'id', 'name']);
    expect(db.records[0].values).toHaveLength(2);
  });

  test('should handle records with later partial overriding earlier partial field', () => {
    const source = `
      TablePartial P1 {
        a int
        shared int
        b int
      }

      TablePartial P2 {
        shared varchar
        c int
      }

      Table T {
        ~P1
        x int [pk]
        ~P2
        y int
      }

      records T(a, b, x, shared, c, y) {
        1, 2, 3, 'shared_value', 4, 5
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);

    // 'shared' should be at P2's position: a, b, x, shared, c, y
    expect(db.records[0].columns).toEqual(['a', 'b', 'x', 'shared', 'c', 'y']);
    expect(db.records[0].values).toHaveLength(1);

    // 'shared' value should be at index 3
    expect(db.records[0].values[0][3]).toEqual({ type: 'string', value: 'shared_value' });
  });

  test('should handle empty partial with explicit columns', () => {
    const source = `
      TablePartial Empty {
      }

      Table T {
        a int [pk]
        ~Empty
        b int
      }

      records T(a, b) {
        1, 2
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);

    // Empty partial shouldn't affect field order
    expect(db.records[0].columns).toEqual(['a', 'b']);
    expect(db.records[0].values).toHaveLength(1);
  });

  test('should handle partial with only overridden fields', () => {
    const source = `
      TablePartial WithOverrides {
        a int
        b int
      }

      Table T {
        a varchar [pk]
        b text
        ~WithOverrides
        c int
      }

      records T(a, b, c) {
        'value_a', 'value_b', 3
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);

    // All partial fields are overridden, so order is: a, b, c
    expect(db.records[0].columns).toEqual(['a', 'b', 'c']);
    expect(db.records[0].values).toHaveLength(1);

    // Values should match the types from direct definitions
    expect(db.records[0].values[0][0]).toEqual({ type: 'string', value: 'value_a' });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'value_b' });
    expect(db.records[0].values[0][2]).toEqual({ type: 'integer', value: 3 });
  });
});
