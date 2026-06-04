import {
  describe, expect, test,
} from 'vitest';
import {
  interpret,
} from '@tests/utils';

describe('[example - record] example setting', () => {
  test('should set example on top-level records with [example]', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) [example] {
        1, 'Alice'
      }
    `;
    const result = interpret(source);
    expect(result.getErrors().length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].example).toBe(true);
  });

  test('should not set example on records without [example]', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, 'Alice'
      }
    `;
    const result = interpret(source);
    expect(result.getErrors().length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].example).toBeUndefined();
  });

  test('should set example on nested records with [example]', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar

        records [example] {
          1, 'Alice'
        }
      }
    `;
    const result = interpret(source);
    expect(result.getErrors().length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].example).toBe(true);
  });

  test('should set example on nested records with column list and [example]', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar

        records (id) [example] {
          1
        }
      }
    `;
    const result = interpret(source);
    expect(result.getErrors().length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].example).toBe(true);
  });

  test('should not set example on nested records without [example]', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar

        records {
          1, 'Alice'
        }
      }
    `;
    const result = interpret(source);
    expect(result.getErrors().length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].example).toBeUndefined();
  });
});
