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
    expect(db.records[0].values[0].id).toMatchObject({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].name).toMatchObject({ type: 'string', value: 'Alice' });
    // age column may not exist on rows that only specified (id, name)
    if ('age' in db.records[0].values[0]) {
      expect(db.records[0].values[0].age).toMatchObject({ type: 'integer', value: null });
    }

    expect(db.records[0].values[1].id).toMatchObject({ type: 'integer', value: 2 });
    expect(db.records[0].values[1].name).toMatchObject({ type: 'string', value: 'Bob' });
    if ('age' in db.records[0].values[1]) {
      expect(db.records[0].values[1].age).toMatchObject({ type: 'integer', value: null });
    }

    // Next two rows from records users(id, age)
    expect(db.records[0].values[2].id).toMatchObject({ type: 'integer', value: 3 });
    if ('name' in db.records[0].values[2]) {
      expect(db.records[0].values[2].name).toMatchObject({ type: 'string', value: null });
    }
    expect(db.records[0].values[2].age).toMatchObject({ type: 'integer', value: 25 });

    expect(db.records[0].values[3].id).toMatchObject({ type: 'integer', value: 4 });
    if ('name' in db.records[0].values[3]) {
      expect(db.records[0].values[3].name).toMatchObject({ type: 'string', value: null });
    }
    expect(db.records[0].values[3].age).toMatchObject({ type: 'integer', value: 30 });
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
    expect(db.records[0].values[0].id).toMatchObject({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].title).toMatchObject({ type: 'string', value: 'First post' });
    // content column may not exist on this row, or may be null
    if ('content' in db.records[0].values[0]) {
      expect(db.records[0].values[0].content).toMatchObject({ type: 'string', value: null });
    }

    // Second row from records posts(id, title, content)
    expect(db.records[0].values[1].id).toMatchObject({ type: 'integer', value: 2 });
    expect(db.records[0].values[1].title).toMatchObject({ type: 'string', value: 'Second post' });
    expect(db.records[0].values[1].content).toMatchObject({ type: 'string', value: 'Content of second post' });
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
