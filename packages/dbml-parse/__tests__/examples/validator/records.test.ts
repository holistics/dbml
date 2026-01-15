import { describe, expect, test } from 'vitest';
import { analyze } from '@tests/utils';

describe('[example] records validator', () => {
  test('should accept valid records', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with various data types', () => {
    const source = `
      Table data {
        int_col int
        float_col decimal(10,2)
        bool_col boolean
        str_col varchar
      }
      records data(int_col, float_col, bool_col, str_col) {
        1, 3.14, true, "hello"
        2, -2.5, false, "world"
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with null values', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, null
        2, ""
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with function expressions', () => {
    const source = `
      Table users {
        id int [pk]
        created_at timestamp
      }
      records users(id, created_at) {
        1, \`now()\`
        2, \`uuid_generate_v4()\`
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with scientific notation', () => {
    const source = `
      Table data {
        id int
        value decimal
      }
      records data(id, value) {
        1, 1e10
        2, 3.14e-5
        3, 2E+8
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with negative numbers', () => {
    const source = `
      Table data {
        id int
        value int
      }
      records data(id, value) {
        1, -100
        2, -999
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with enum values', () => {
    const source = `
      Enum status { active\n inactive }
      Table users {
        id int
        status status
      }
      records users(id, status) {
        1, status.active
        2, status.inactive
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should detect unknown table in records', () => {
    const source = `
      records nonexistent(id, name) {
        1, "Alice"
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors.length).toBeGreaterThan(0);
  });

  test('should detect unknown column in records', () => {
    const source = `
      Table users {
        id int
      }
      records users(id, unknown_column) {
        1, "value"
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors.length).toBeGreaterThan(0);
  });

  test('should accept multiple records blocks for same table', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
      }
      records users(id, name) {
        2, "Bob"
      }
      records users(id, name) {
        3, "Charlie"
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with schema-qualified table name', () => {
    const source = `
      Table auth.users {
        id int [pk]
        email varchar
      }
      records auth.users(id, email) {
        1, "alice@example.com"
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with quoted column names', () => {
    const source = `
      Table users {
        "user-id" int [pk]
        "user-name" varchar
      }
      records users("user-id", "user-name") {
        1, "Alice"
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept empty records block', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test('should accept records with only one column', () => {
    const source = `
      Table ids {
        id int [pk]
      }
      records ids(id) {
        1
        2
        3
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });
});
