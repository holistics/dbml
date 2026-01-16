import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

describe('[example - record] multiple records blocks', () => {
  test('should handle multiple records blocks for the same table with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        age int
        email varchar
      }

      records users(id, name) {
        1, 'Alice'
        2, 'Bob'
      }

      records users(id, age) {
        3, 25
        4, 30
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Multiple records blocks for the same table are merged into one
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('users');

    // The merged records contain all unique columns that were actually used
    expect(db.records[0].columns).toEqual(['id', 'name', 'age']);

    // Check the data rows (columns not included in a specific records block may be undefined or null)
    expect(db.records[0].values.length).toBe(4);

    // First two rows from records users(id, name)
    // columns = ['id', 'name', 'age']
    expect(db.records[0].values[0][0]).toMatchObject({ type: 'integer', value: 1 }); // id
    expect(db.records[0].values[0][1]).toMatchObject({ type: 'string', value: 'Alice' }); // name
    // age column may not exist on rows that only specified (id, name)
    if (db.records[0].values[0].length > 2) {
      expect(db.records[0].values[0][2]).toMatchObject({ type: 'unknown', value: null }); // age
    }

    expect(db.records[0].values[1][0]).toMatchObject({ type: 'integer', value: 2 }); // id
    expect(db.records[0].values[1][1]).toMatchObject({ type: 'string', value: 'Bob' }); // name
    if (db.records[0].values[1].length > 2) {
      expect(db.records[0].values[1][2]).toMatchObject({ type: 'unknown', value: null }); // age
    }

    // Next two rows from records users(id, age)
    expect(db.records[0].values[2][0]).toMatchObject({ type: 'integer', value: 3 }); // id
    if (db.records[0].values[2].length > 1) {
      expect(db.records[0].values[2][1]).toMatchObject({ type: 'unknown', value: null }); // name
    }
    expect(db.records[0].values[2][2]).toMatchObject({ type: 'integer', value: 25 }); // age

    expect(db.records[0].values[3][0]).toMatchObject({ type: 'integer', value: 4 }); // id
    if (db.records[0].values[3].length > 1) {
      expect(db.records[0].values[3][1]).toMatchObject({ type: 'unknown', value: null }); // name
    }
    expect(db.records[0].values[3][2]).toMatchObject({ type: 'integer', value: 30 }); // age
  });

  test('should handle multiple records blocks, one with explicit columns and one without', () => {
    const source = `
      Table posts {
        id int [pk]
        title varchar
        content text
      }

      records posts(id, title) {
        1, 'First post'
      }

      records posts(id, title, content) {
        2, 'Second post', 'Content of second post'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Multiple records blocks for the same table are merged into one
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('posts');

    // The merged records contain all unique columns
    expect(db.records[0].columns).toEqual(['id', 'title', 'content']);

    // Check the data rows
    expect(db.records[0].values.length).toBe(2);

    // First row from records posts(id, title)
    // columns = ['id', 'title', 'content']
    expect(db.records[0].values[0][0]).toMatchObject({ type: 'integer', value: 1 }); // id
    expect(db.records[0].values[0][1]).toMatchObject({ type: 'string', value: 'First post' }); // title
    // content column may not exist on this row, or may be null
    if (db.records[0].values[0].length > 2) {
      expect(db.records[0].values[0][2]).toMatchObject({ type: 'unknown', value: null }); // content
    }

    // Second row from records posts(id, title, content)
    expect(db.records[0].values[1][0]).toMatchObject({ type: 'integer', value: 2 }); // id
    expect(db.records[0].values[1][1]).toMatchObject({ type: 'string', value: 'Second post' }); // title
    expect(db.records[0].values[1][2]).toMatchObject({ type: 'string', value: 'Content of second post' }); // content
  });

  test('should report error for inconsistent column count in implicit records', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal
      }

      records products(id, name) {
        1, 'Laptop'
      }

      records products(id, name) {
        2, 'Mouse' // Has 2 values for 2 columns - this is valid
      }

      records products(id, name, price) {
        3, 'Keyboard' // Missing price - only 2 values for 3 columns
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(errors[0].diagnostic).toBe('Expected 3 values but got 2');
  });
});
