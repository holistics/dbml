import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/index';
import { DateTime } from 'luxon';

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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].diagnostic).toBe("Invalid boolean value for column 'active'");
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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].diagnostic).toBe("Invalid boolean value for column 'active'");
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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].diagnostic).toBe("Invalid numeric value for column 'id'");
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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].diagnostic).toBe("NULL not allowed for non-nullable column 'name' without default and increment");
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
      const warnings = result.getWarnings();

      // NULL should be valid syntax
      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].diagnostic).toBe("NULL not allowed for non-nullable column 'name' without default and increment");
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
          1, "2024-01-15T10:30:00+07:00", "2024-01-15"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1].type).toBe('datetime');
      expect(db.records[0].values[0][1].value).toBe(DateTime.fromISO('2024-01-15T10:30:00.000+07:00').toISO());
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

      // This is a BINDING_ERROR, not a validation error, so it stays as an error
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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].diagnostic).toBe("Invalid enum value for column 'status'");
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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(3);
      expect(warnings[0].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(warnings[1].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(warnings[2].diagnostic).toBe("Invalid boolean value for column 'active'");
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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(3);
      expect(warnings[0].diagnostic).toBe("Invalid numeric value for column 'id'");
      expect(warnings[1].diagnostic).toBe("Invalid numeric value for column 'price'");
      expect(warnings[2].diagnostic).toBe("Invalid numeric value for column 'price'");
    });

    test('- should allow non-string values for string types', () => {
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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
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
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(2);
      expect(warnings[0].diagnostic).toContain("Invalid datetime value for column 'created_at'");
      expect(warnings[1].diagnostic).toContain("Invalid datetime value for column 'created_at'");
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

describe('[example - record] String length validation', () => {
  describe('VARCHAR length validation', () => {
    test('should accept string values within length limit', () => {
      const source = `
        Table users {
          id int
          name varchar(50)
          email varchar(100)
        }

        records users(id, name, email) {
          1, "Alice", "alice@example.com"
          2, "Bob Smith", "bob.smith@company.org"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });

    test('should reject string value exceeding length limit', () => {
      const source = `
        Table users {
          id int
          name varchar(5)
        }

        records users(id, name) {
          1, "Alice Johnson"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 13 bytes");
    });

    test('should accept empty string for varchar', () => {
      const source = `
        Table users {
          id int
          name varchar(50)
        }

        records users(id, name) {
          1, ""
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });

    test('should accept string at exact length limit', () => {
      const source = `
        Table users {
          id int
          code varchar(5)
        }

        records users(id, code) {
          1, "ABCDE"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });

    test('should validate multiple varchar columns', () => {
      const source = `
        Table users {
          id int
          first_name varchar(10)
          last_name varchar(10)
        }

        records users(id, first_name, last_name) {
          1, "Alice", "Smith"
          2, "Christopher", "Johnson"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("String value for column 'first_name' exceeds maximum length: expected at most 10 bytes (UTF-8), got 11 bytes");
    });
  });

  describe('CHAR length validation', () => {
    test('should accept string values within char limit', () => {
      const source = `
        Table codes {
          id int
          code char(10)
        }

        records codes(id, code) {
          1, "ABC123"
          2, "XYZ"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });

    test('should reject string value exceeding char limit', () => {
      const source = `
        Table codes {
          id int
          code char(3)
        }

        records codes(id, code) {
          1, "ABCD"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("String value for column 'code' exceeds maximum length: expected at most 3 bytes (UTF-8), got 4 bytes");
    });
  });

  describe('Other string types with length', () => {
    test('should validate nvarchar length', () => {
      const source = `
        Table users {
          id int
          name nvarchar(5)
        }

        records users(id, name) {
          1, "Alice Johnson"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 13 bytes");
    });

    test('should validate nchar length', () => {
      const source = `
        Table codes {
          id int
          code nchar(3)
        }

        records codes(id, code) {
          1, "ABCD"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("String value for column 'code' exceeds maximum length: expected at most 3 bytes (UTF-8), got 4 bytes");
    });

    test('should validate character varying length', () => {
      const source = `
        Table users {
          id int
          name "character varying"(10)
        }

        records users(id, name) {
          1, "Christopher"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 10 bytes (UTF-8), got 11 bytes");
    });
  });

  describe('String types without length parameter', () => {
    test('should allow any length for text type', () => {
      const source = `
        Table articles {
          id int
          content text
        }

        records articles(id, content) {
          1, "This is a very long text content that can be arbitrarily long without any length restrictions because text type does not have a length parameter"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });

    test('should allow any length for varchar without parameter', () => {
      const source = `
        Table users {
          id int
          description varchar
        }

        records users(id, description) {
          1, "This is a very long description that can be arbitrarily long"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });
  });

  describe('Edge cases', () => {
    test('should count unicode characters using UTF-8 byte length', () => {
      const source = `
        Table messages {
          id int
          text varchar(20)
        }

        records messages(id, text) {
          1, "Hello"
          2, "😀😁😂😃😄"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      // "😀😁😂😃😄" is 5 emojis × 4 bytes each = 20 bytes
      expect(errors.length).toBe(0);
    });

    test('should reject string with multi-byte characters exceeding byte limit', () => {
      const source = `
        Table messages {
          id int
          text varchar(10)
        }

        records messages(id, text) {
          1, "😀😁😂"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      // "😀😁😂" is 3 emojis × 4 bytes each = 12 bytes, exceeds varchar(10)
      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toContain('exceeds maximum length: expected at most 10 bytes');
    });

    test('should validate multiple errors in one record', () => {
      const source = `
        Table users {
          id int
          first_name varchar(5)
          last_name varchar(5)
          email varchar(10)
        }

        records users(id, first_name, last_name, email) {
          1, "Christopher", "Johnson", "chris.johnson@example.com"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(3);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("String value for column 'first_name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 11 bytes");
      expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[1].diagnostic).toBe("String value for column 'last_name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 7 bytes");
      expect(warnings[2].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[2].diagnostic).toBe("String value for column 'email' exceeds maximum length: expected at most 10 bytes (UTF-8), got 25 bytes");
    });

    test('should validate across multiple records', () => {
      const source = `
        Table users {
          id int
          name varchar(5)
        }

        records users(id, name) {
          1, "Alice"
          2, "Bob"
          3, "Christopher"
          4, "Dave"
          5, "Elizabeth"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(2);
      expect(warnings[0].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 11 bytes");
      expect(warnings[1].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 9 bytes");
    });
  });
});

describe('[example - record] Numeric type validation', () => {
  describe('Integer validation', () => {
    test('should accept valid integer values', () => {
      const source = `
        Table products {
          id int
          quantity bigint
          serial_num smallint
        }

        records products(id, quantity, serial_num) {
          1, 1000, 5
          2, -500, -10
          3, 0, 0
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should reject decimal value for integer column', () => {
      const source = `
        Table products {
          id int
          quantity int
        }

        records products(id, quantity) {
          1, 10.5
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Invalid integer value 10.5 for column 'quantity': expected integer, got decimal");
    });

    test('should reject multiple decimal values for integer columns', () => {
      const source = `
        Table products {
          id int
          quantity int
          stock int
        }

        records products(id, quantity, stock) {
          1, 10.5, 20
          2, 15, 30.7
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(2);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Invalid integer value 10.5 for column 'quantity': expected integer, got decimal");
      expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[1].diagnostic).toBe("Invalid integer value 30.7 for column 'stock': expected integer, got decimal");
    });

    test('should accept negative integers', () => {
      const source = `
        Table transactions {
          id int
          amount int
        }

        records transactions(id, amount) {
          1, -100
          2, -500
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('Decimal/numeric precision and scale validation', () => {
    test('should accept valid decimal values within precision and scale', () => {
      const source = `
        Table products {
          id int
          price decimal(10, 2)
          rate numeric(5, 3)
        }

        records products(id, price, rate) {
          1, 99.99, 1.234
          2, 12345678.90, 12.345
          3, -999.99, -0.001
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should reject decimal value exceeding precision', () => {
      const source = `
        Table products {
          id int
          price decimal(5, 2)
        }

        records products(id, price) {
          1, 12345.67
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Numeric value 12345.67 for column 'price' exceeds precision: expected at most 5 total digits, got 7");
    });

    test('should reject decimal value exceeding scale', () => {
      const source = `
        Table products {
          id int
          price decimal(10, 2)
        }

        records products(id, price) {
          1, 99.999
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Numeric value 99.999 for column 'price' exceeds scale: expected at most 2 decimal digits, got 3");
    });

    test('should accept decimal value with fewer decimal places than scale', () => {
      const source = `
        Table products {
          id int
          price decimal(10, 2)
        }

        records products(id, price) {
          1, 99.9
          2, 100
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should handle negative decimal values correctly', () => {
      const source = `
        Table transactions {
          id int
          amount decimal(8, 2)
        }

        records transactions(id, amount) {
          1, -12345.67
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should reject negative decimal value exceeding precision', () => {
      const source = `
        Table transactions {
          id int
          amount decimal(5, 2)
        }

        records transactions(id, amount) {
          1, -12345.67
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Numeric value -12345.67 for column 'amount' exceeds precision: expected at most 5 total digits, got 7");
    });

    test('should validate multiple decimal columns', () => {
      const source = `
        Table products {
          id int
          price decimal(5, 2)
          tax_rate decimal(5, 2)
        }

        records products(id, price, tax_rate) {
          1, 12345.67, 0.99
          2, 99.99, 10.123
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(2);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Numeric value 12345.67 for column 'price' exceeds precision: expected at most 5 total digits, got 7");
      expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[1].diagnostic).toBe("Numeric value 10.123 for column 'tax_rate' exceeds scale: expected at most 2 decimal digits, got 3");
    });

    test('should allow decimal/numeric types without precision parameters', () => {
      const source = `
        Table products {
          id int
          price decimal
          rate numeric
        }

        records products(id, price, rate) {
          1, 999999999.999999, 123456.789012
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('Float/double validation', () => {
    test('should accept valid float values', () => {
      const source = `
        Table measurements {
          id int
          temperature float
          pressure double
        }

        records measurements(id, temperature, pressure) {
          1, 98.6, 101325.5
          2, -40.0, 0.001
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should accept integers for float columns', () => {
      const source = `
        Table measurements {
          id int
          value float
        }

        records measurements(id, value) {
          1, 100
          2, -50
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('Scientific notation validation', () => {
    test('should accept scientific notation that evaluates to integer', () => {
      const source = `
        Table data {
          id int
          count int
        }

        records data(id, count) {
          1, 1e2
          2, 2E3
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should reject scientific notation that evaluates to decimal for integer column', () => {
      const source = `
        Table data {
          id int
          count int
        }

        records data(id, count) {
          1, 2e-1
          2, 3.5e-1
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(2);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Invalid integer value 0.2 for column 'count': expected integer, got decimal");
      expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[1].diagnostic).toBe("Invalid integer value 0.35 for column 'count': expected integer, got decimal");
    });

    test('should accept scientific notation for decimal/numeric types', () => {
      const source = `
        Table data {
          id int
          value decimal(10, 2)
        }

        records data(id, value) {
          1, 1.5e2
          2, 3.14e1
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('should validate precision/scale for scientific notation', () => {
      const source = `
        Table data {
          id int
          value decimal(5, 2)
        }

        records data(id, value) {
          1, 1e6
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Numeric value 1000000 for column 'value' exceeds precision: expected at most 5 total digits, got 7");
    });

    test('should accept scientific notation for float types', () => {
      const source = `
        Table measurements {
          id int
          temperature float
          distance double
        }

        records measurements(id, temperature, distance) {
          1, 3.14e2, 1.5e10
          2, -2.5e-3, 6.67e-11
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });
  });

  describe('Mixed numeric type validation', () => {
    test('should validate multiple numeric types in one table', () => {
      const source = `
        Table products {
          id int
          quantity int
          price decimal(10, 2)
          weight float
        }

        records products(id, quantity, price, weight) {
          1, 10, 99.99, 1.5
          2, 20.5, 199.99, 2.75
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("Invalid integer value 20.5 for column 'quantity': expected integer, got decimal");
    });
  });
});

describe('[example - record] Enum validation', () => {
  test('should accept valid enum values with enum access syntax', () => {
    const source = `
      Enum status {
        active
        inactive
        pending
      }

      Table users {
        id int [pk]
        name varchar
        status status
      }

      records users(id, name, status) {
        1, "Alice", status.active
        2, "Bob", status.inactive
        3, "Charlie", status.pending
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should accept valid enum values with string literals', () => {
    const source = `
      Enum status {
        active
        inactive
      }

      Table users {
        id int [pk]
        name varchar
        status status
      }

      records users(id, name, status) {
        1, "Alice", "active"
        2, "Bob", "inactive"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should detect invalid enum value with enum access syntax', () => {
    const source = `
      Enum status {
        active
        inactive
      }

      Table users {
        id int [pk]
        name varchar
        status status
      }

      records users(id, name, status) {
        1, "Alice", status.active
        2, "Bob", status.invalid
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // Enum access with invalid value produces a BINDING_ERROR (can't resolve status.invalid)
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.BINDING_ERROR);
    expect(errors[0].diagnostic).toContain('invalid');
  });

  test('should detect invalid enum value with string literal', () => {
    const source = `
      Enum status {
        active
        inactive
      }

      Table users {
        id int [pk]
        name varchar
        status status
      }

      records users(id, name, status) {
        1, "Alice", "active"
        2, "Bob", "invalid_value"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();
    const warnings = result.getWarnings();

    expect(errors.length).toBe(0);
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe("Invalid enum value for column 'status'");
  });

  test('should validate multiple enum columns', () => {
    const source = `
      Enum status {
        active
        inactive
      }

      Enum role {
        admin
        user
      }

      Table users {
        id int [pk]
        name varchar
        status status
        role role
      }

      records users(id, name, status, role) {
        1, "Alice", "active", "admin"
        2, "Bob", "invalid_status", "user"
        3, "Charlie", "active", "invalid_role"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();
    const warnings = result.getWarnings();

    expect(errors.length).toBe(0);
    expect(warnings.length).toBe(2);
    expect(warnings.every((e) => e.code === CompileErrorCode.INVALID_RECORDS_FIELD)).toBe(true);
    const warningMessages = warnings.map((e) => e.diagnostic);
    expect(warningMessages).toMatchInlineSnapshot(`
      [
        "Invalid enum value for column 'status'",
        "Invalid enum value for column 'role'",
      ]
    `);
  });

  test('should allow NULL for enum columns', () => {
    const source = `
      Enum status {
        active
        inactive
      }

      Table users {
        id int [pk]
        name varchar
        status status
      }

      records users(id, name, status) {
        1, "Alice", "active"
        2, "Bob", null
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);
  });

  test('should validate enum with schema-qualified name', () => {
    const source = `
      Enum app.status {
        active
        inactive
      }

      Table app.users {
        id int [pk]
        status app.status
      }

      records app.users(id, status) {
        1, app.status.active
        2, app.status.invalid
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // app.status.invalid produces a BINDING_ERROR (can't resolve invalid field)
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.BINDING_ERROR);
    expect(errors[0].diagnostic).toContain('invalid');
  });

  test('should accept string literal for schema-qualified enum', () => {
    const source = `
      Enum app.status {
        active
        inactive
      }

      Table app.users {
        id int [pk]
        status app.status
      }

      records app.users(id, status) {
        1, "active"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();
    const warnings = result.getWarnings();

    expect(errors.length).toBe(0);
    expect(warnings.length).toBe(0);
  });

  test('should reject unqualified enum access for schema-qualified enum', () => {
    const source = `
      Enum app.status {
        active
        inactive
      }

      Table app.users {
        id int [pk]
        status app.status
      }

      records app.users(id, status) {
        1, status.active
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // The binder catches this error - it can't resolve 'status' in the app schema context
    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.BINDING_ERROR);
    expect(errors[0].diagnostic).toContain('status');
  });

  test('should validate enum from table partial', () => {
    const source = `
      Enum priority {
        low
        medium
        high
      }

      TablePartial audit_fields {
        priority priority
      }

      Table tasks {
        id int [pk]
        name varchar
        ~audit_fields
      }

      records tasks(id, name, priority) {
        1, "Task 1", "high"
        2, "Task 2", "invalid_priority"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();
    const warnings = result.getWarnings();

    expect(errors.length).toBe(0);
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe('Invalid enum value for column \'priority\'');
  });
});
