import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example - record] type compatibility validation', () => {
  describe('boolean type validation', () => {
    test('- should accept all valid boolean literal values', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, true
          2, false
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records.length).toBe(1);
      expect(db.records[0].values.length).toBe(2);
      expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[1][1]).toEqual({ type: 'bool', value: false });
    });

    test('- should accept string boolean values (true/false)', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, 'true'
          2, "false"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[1][1]).toEqual({ type: 'bool', value: false });
    });

    test('- should accept string boolean values (t/f)', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, 't'
          2, 'f'
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[1][1]).toEqual({ type: 'bool', value: false });
    });

    test('- should accept string boolean values (y/n)', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, 'y'
          2, 'n'
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[1][1]).toEqual({ type: 'bool', value: false });
    });

    test('- should accept string boolean values (yes/no)', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, 'yes'
          2, "no"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[1][1]).toEqual({ type: 'bool', value: false });
    });

    test('- should accept numeric boolean values (1/0)', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, 1
          2, 0
          3, '1'
          4, "0"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[1][1]).toEqual({ type: 'bool', value: false });
      expect(db.records[0].values[2][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[3][1]).toEqual({ type: 'bool', value: false });
    });

    test('- should reject invalid string value for boolean column', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, "invalid"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("Invalid boolean value for column 'active'");
    });

    test('- should reject numeric values other than 0/1 for boolean column', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, 2
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("Invalid boolean value for column 'active'");
    });
  });

  describe('numeric type validation', () => {
    test('- should reject string value for integer column', () => {
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

    test('- should accept valid decimal values', () => {
      const source = `
        Table data {
          id int
          price decimal(10,2)
          rate float
        }
        records data(id, price, rate) {
          1, 99.99, 3.14159
          2, -50.00, -2.5
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'real', value: 99.99 });
      expect(db.records[0].values[0][2]).toEqual({ type: 'real', value: 3.14159 });
    });

    test('- should accept scientific notation for numeric columns', () => {
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
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'real', value: 1e10 });
      expect(db.records[0].values[1][1]).toEqual({ type: 'real', value: 3.14e-5 });
      expect(db.records[0].values[2][1]).toEqual({ type: 'real', value: 2e8 });
    });
  });

  describe('string type validation', () => {
    test('- should accept single-quoted strings', () => {
      const source = `
        Table data {
          id int
          name varchar
        }
        records data(id, name) {
          1, 'Alice'
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Alice' });
    });

    test('- should accept double-quoted strings', () => {
      const source = `
        Table data {
          id int
          name varchar
        }
        records data(id, name) {
          1, "Bob"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Bob' });
    });

    test('- should accept empty strings for string columns', () => {
      const source = `
        Table data {
          id int
          name varchar
        }
        records data(id, name) {
          1, ""
          2, ''
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: '' });
      expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: '' });
    });

    test('- should treat empty field as null for non-string columns', () => {
      const source = `
        Table data {
          id int
          count int
          name varchar
        }
        records data(id, count, name) {
          1, , "test"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
      expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][2]).toEqual({ type: 'string', value: 'test' });
    });

    test('- should handle various null forms correctly', () => {
      const source = `
        Table data {
          id int
          count int
          amount decimal
          name varchar
          description text
        }
        records data(id, count, amount, name, description) {
          1, null, null, null, null
          2, , , ,
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      // Row 1: explicit null keyword
      expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][2]).toEqual({ type: 'real', value: null });
      expect(db.records[0].values[0][3]).toEqual({ type: 'string', value: null });
      expect(db.records[0].values[0][4]).toEqual({ type: 'string', value: null });

      // Row 2: empty field (treated as null for non-string, null for string)
      expect(db.records[0].values[1][1]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[1][2]).toEqual({ type: 'real', value: null });
      expect(db.records[0].values[1][3]).toEqual({ type: 'string', value: null });
      expect(db.records[0].values[1][4]).toEqual({ type: 'string', value: null });
    });

    test('- should accept strings with special characters', () => {
      const source = `
        Table data {
          id int
          content text
        }
        records data(id, content) {
          1, "Line 1\\nLine 2"
          2, 'Tab\\tSeparated'
          3, "Quote: \\"test\\""
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('null handling', () => {
    test('- should accept null for nullable column', () => {
      const source = `
        Table users {
          id int [pk]
          name varchar [null]
          email varchar
        }
        records users(id, name, email) {
          1, null, null
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: null });
      expect(db.records[0].values[0][2]).toEqual({ type: 'string', value: null });
    });

    test('- should reject NULL for NOT NULL column without default and increment', () => {
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
      expect(errors[0].diagnostic).toBe("NULL not allowed for NOT NULL column 'name' without default and increment");
    });

    test('- should allow NULL for NOT NULL column with default', () => {
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

      // Row 1: id=1, status=null (null stored, default applied at DB level)
      expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
      expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: null });

      // Row 2: id=2, status="inactive"
      expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
      expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'inactive' });
    });

    test('- should allow NULL for auto-increment column', () => {
      const source = `
        Table users {
          id int [pk, increment]
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
      expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: null });
    });

    test('- should reject explicit null keyword in various casings (if invalid)', () => {
      const source = `
        Table users {
          id int
          name varchar [not null]
        }
        records users(id, name) {
          1, NULL
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      // NULL should be valid syntax
      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("NULL not allowed for NOT NULL column 'name' without default and increment");
    });
  });

  describe('datetime type validation', () => {
    test('- should accept string datetime values', () => {
      const source = `
        Table events {
          id int
          created_at timestamp
          event_date date
        }
        records events(id, created_at, event_date) {
          1, "2024-01-15 10:30:00", "2024-01-15"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1].type).toBe('datetime');
      expect(db.records[0].values[0][1].value).toBe('2024-01-15 10:30:00');
      expect(db.records[0].values[0][2].type).toBe('date');
      expect(db.records[0].values[0][2].value).toBe('2024-01-15');
    });
  });

  describe('enum type validation', () => {
    test('- should accept schema-qualified enum values', () => {
      const source = `
        Enum auth.role {
          admin
          user
        }
        Table auth.users {
          id int [pk]
          role auth.role
        }
        records auth.users(id, role) {
          1, auth.role.admin
          2, auth.role.user
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('- should reject invalid enum field', () => {
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

    test('- should reject numeric value for enum column', () => {
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
          1, 1
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(1);
      expect(errors[0].diagnostic).toBe("Invalid enum value for column 'status'");
    });
  });

  describe('invalid type tests', () => {
    test('- should reject invalid boolean values', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, "not_a_bool"
          2, 99
          3, -1
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(3);
      expect(errors[0].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(errors[1].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(errors[2].diagnostic).toBe("Invalid boolean value for column 'active'");
    });

    test('- should reject invalid numeric values', () => {
      const source = `
        Table data {
          id int
          price decimal
        }
        records data(id, price) {
          "not_a_number", 100.00
          2, "also_not_a_number"
          3, true
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(3);
      expect(errors[0].diagnostic).toBe("Invalid numeric value for column 'id'");
      expect(errors[1].diagnostic).toBe("Invalid numeric value for column 'price'");
      expect(errors[2].diagnostic).toBe("Invalid numeric value for column 'price'");
    });

    test('- should reject invalid string values', () => {
      const source = `
        Table data {
          id int
          name varchar
        }
        records data(id, name) {
          1, 123
          2, true
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(2);
      expect(errors[0].diagnostic).toBe("Invalid string value for column 'name'");
      expect(errors[1].diagnostic).toBe("Invalid string value for column 'name'");
    });

    test('- should reject invalid datetime values', () => {
      const source = `
        Table events {
          id int
          created_at timestamp
        }
        records events(id, created_at) {
          1, 12345
          2, true
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(2);
      expect(errors[0].diagnostic).toContain("Invalid datetime value for column 'created_at'");
      expect(errors[1].diagnostic).toContain("Invalid datetime value for column 'created_at'");
    });
  });

  describe('null and empty field handling', () => {
    test('- should treat empty field as null for numeric types', () => {
      const source = `
        Table data {
          id int
          count int
          price decimal
        }
        records data(id, count, price) {
          1, ,
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
      expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][2]).toEqual({ type: 'real', value: null });
    });

    test('- should treat empty field as null for boolean type', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1,
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: null });
    });

    test('- should treat empty field as null for datetime type', () => {
      const source = `
        Table events {
          id int
          created_at timestamp
        }
        records events(id, created_at) {
          1,
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'datetime', value: null });
    });

    test('- should treat empty field as null for enum type', () => {
      const source = `
        Enum status {
          active
          inactive
        }
        Table users {
          id int
          status status
        }
        records users(id, status) {
          1,
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      // Empty field for enum is treated as string null
      expect(db.records[0].values[0][1].type).toBe('string');
      expect(db.records[0].values[0][1].value).toBe(null);
    });

    test('- should treat empty string as null for non-string types', () => {
      const source = `
        Table data {
          id int
          count int
          active boolean
          name varchar
        }
        records data(id, count, active, name) {
          "", "", "", ""
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      // Empty strings are treated as null for non-string types, empty string for string types
      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][2]).toEqual({ type: 'bool', value: null });
      expect(db.records[0].values[0][3]).toEqual({ type: 'string', value: '' });
    });

    test('- should accept empty string for string types', () => {
      const source = `
        Table data {
          id int
          name varchar
          description text
        }
        records data(id, name, description) {
          1, "", ""
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: '' });
      expect(db.records[0].values[0][2]).toEqual({ type: 'string', value: '' });
    });
  });
});
