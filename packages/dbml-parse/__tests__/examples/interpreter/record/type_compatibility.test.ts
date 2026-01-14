import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example - record] type compatibility validation', () => {
  test('should reject string value for integer column', () => {
    const source = `
      Table data {
        id int
        name varchar
      }
      records data(id, name) {
        "not a number", "Alice"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Invalid numeric value for column 'id'");
  });

  test('should reject invalid string value for boolean column', () => {
    const source = `
      Table data {
        id int
        active boolean
      }
      records data(id, active) {
        1, "invalid"
        2, 't'
        3, 'f'
        4, 'y'
        5, 'n'
        6, 'true'
        7, "false"
        8, '1'
        9, "0"
        10, 1
        11, 0
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // Note: "yes", "no", "true", "false", "1", "0", "t", "f", "y", "n" are all valid boolean strings
    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Invalid boolean value for column 'active'");
  });

  test('should reject NULL for NOT NULL column without default', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar [not null]
      }
      records users(id, name) {
        1, null
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("NULL not allowed for NOT NULL column 'name' without default");
  });

  test('should use default value when NULL provided for NOT NULL column with default', () => {
    const source = `
      Table users {
        id int [pk]
        status varchar [not null, default: 'active']
      }
      records users(id, status) {
        1, null
        2, "inactive"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values.length).toBe(2);

    // Row 1: id=1, status=null (null stored to preserve original data, default applied at DB level)
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1].value).toBe(null);
    expect(db.records[0].values[0][1].type).toBe('string');

    // Row 2: id=2, status="inactive"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'inactive' });
  });

  test('should validate enum values', () => {
    const source = `
      Enum status {
        active
        inactive
      }
      Table users {
        id int [pk]
        status status
      }
      records users(id, status) {
        1, status.active
        2, status.invalid
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Enum field 'invalid' does not exist in Enum 'status'");
  });
});
