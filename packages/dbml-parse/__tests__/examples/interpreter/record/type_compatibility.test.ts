import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/index';
import { DateTime } from 'luxon';

describe('[example - record] type compatibility validation', () => {
  describe('boolean type validation', () => {
    test('- should accept all valid boolean formats', () => {
      const source = `
        Table data {
          id int
          active boolean
        }
        records data(id, active) {
          1, true
          2, false
          3, 'true'
          4, "false"
          5, 't'
          6, 'f'
          7, 'y'
          8, 'n'
          9, 'yes'
          10, "no"
          11, 1
          12, 0
          13, '1'
          14, "0"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records.length).toBe(1);
      expect(db.records[0].values.length).toBe(14);
      expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[1][1]).toEqual({ type: 'bool', value: false });
      expect(db.records[0].values[2][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[3][1]).toEqual({ type: 'bool', value: false });
      expect(db.records[0].values[4][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[5][1]).toEqual({ type: 'bool', value: false });
      expect(db.records[0].values[6][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[7][1]).toEqual({ type: 'bool', value: false });
      expect(db.records[0].values[8][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[9][1]).toEqual({ type: 'bool', value: false });
      expect(db.records[0].values[10][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[11][1]).toEqual({ type: 'bool', value: false });
      expect(db.records[0].values[12][1]).toEqual({ type: 'bool', value: true });
      expect(db.records[0].values[13][1]).toEqual({ type: 'bool', value: false });
    });

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
          4, "invalid"
          5, 2
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(5);
      expect(warnings[0].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(warnings[1].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(warnings[2].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(warnings[3].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(warnings[4].diagnostic).toBe("Invalid boolean value for column 'active'");
    });
  });

  describe('numeric type validation', () => {
    test('- should accept valid integer and decimal values', () => {
      const source = `
        Table data {
          id int
          quantity bigint
          serial_num smallint
          price decimal(10,2)
          rate float
          amount double
        }
        records data(id, quantity, serial_num, price, rate, amount) {
          1, 1000, 5, 99.99, 3.14159, 101325.5
          2, -500, -10, -50.00, -2.5, -40.0
          3, 0, 0, 0, 0, 0.001
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][3]).toEqual({ type: 'real', value: 99.99 });
      expect(db.records[0].values[0][4]).toEqual({ type: 'real', value: 3.14159 });
    });

    test('- should accept scientific notation for numeric columns', () => {
      const source = `
        Table data {
          id int
          value decimal
          count int
          temperature float
        }
        records data(id, value, count, temperature) {
          1, 1e10, 1e2, 3.14e2
          2, 3.14e-5, 2E3, -2.5e-3
          3, 2E+8, ,
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

    test('- should reject invalid numeric values', () => {
      const source = `
        Table data {
          id int
          quantity int
          price decimal
        }
        records data(id, quantity, price) {
          "not_a_number", 100, 100.00
          2, 10.5, 100.00
          3, 20, "also_not_a_number"
          4, 30, true
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(4);
      expect(warnings[0].diagnostic).toBe("Invalid numeric value for column 'id'");
      expect(warnings[1].diagnostic).toBe("Invalid integer value 10.5 for column 'quantity': expected integer, got decimal");
      expect(warnings[2].diagnostic).toBe("Invalid numeric value for column 'price'");
      expect(warnings[3].diagnostic).toBe("Invalid numeric value for column 'price'");
    });

    test('- should validate decimal precision and scale', () => {
      const source = `
        Table products {
          id int
          price decimal(5, 2)
          rate numeric(10, 3)
        }
        records products(id, price, rate) {
          1, 99.99, 1.234
          2, 12345.67, 12345.678
          3, 99.999, 1234567.890
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBeGreaterThan(0);

      // Verify all warnings are about exceeding precision or scale
      expect(warnings.every((w) => w.code === CompileErrorCode.INVALID_RECORDS_FIELD)).toBe(true);
      expect(warnings.every((w) => w.diagnostic.includes('exceeds'))).toBe(true);

      // Verify specific precision/scale violations exist
      const precisionWarnings = warnings.filter((w) => w.diagnostic.includes('exceeds precision'));
      const scaleWarnings = warnings.filter((w) => w.diagnostic.includes('exceeds scale'));

      expect(precisionWarnings.length).toBeGreaterThan(0);
      expect(scaleWarnings.length).toBeGreaterThan(0);
    });
  });

  describe('string type validation', () => {
    test('- should accept various string formats and special characters', () => {
      const source = `
        Table data {
          id int
          name varchar
          title text
          content text
        }
        records data(id, name, title, content) {
          1, 'Alice', "Bob", "Line 1\\nLine 2"
          2, "", '', 'Tab\\tSeparated'
          3, 123, true, "Quote: \\"test\\""
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Alice' });
      expect(db.records[0].values[0][2]).toEqual({ type: 'string', value: 'Bob' });
      expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: '' });
      expect(db.records[0].values[1][2]).toEqual({ type: 'string', value: '' });
    });

    test('- should validate string length for varchar, char, nvarchar, nchar', () => {
      const source = `
        Table users {
          id int
          name varchar(5)
          code char(3)
          title nvarchar(10)
          shortcode nchar(4)
          description "character varying"(8)
        }
        records users(id, name, code, title, shortcode, description) {
          1, "Alice", "ABC", "Manager", "MGMT", "Valid"
          2, "VeryLongName", "ABCD", "VeryLongTitle", "TOOLONG", "TooLongDesc"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(5);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 12 bytes");
      expect(warnings[1].diagnostic).toBe("String value for column 'code' exceeds maximum length: expected at most 3 bytes (UTF-8), got 4 bytes");
      expect(warnings[2].diagnostic).toBe("String value for column 'title' exceeds maximum length: expected at most 10 bytes (UTF-8), got 13 bytes");
      expect(warnings[3].diagnostic).toBe("String value for column 'shortcode' exceeds maximum length: expected at most 4 bytes (UTF-8), got 7 bytes");
      expect(warnings[4].diagnostic).toBe("String value for column 'description' exceeds maximum length: expected at most 8 bytes (UTF-8), got 11 bytes");
    });

    test('- should accept strings within length and exact length', () => {
      const source = `
        Table users {
          id int
          code varchar(5)
          name char(10)
        }
        records users(id, code, name) {
          1, "ABCDE", "Alice"
          2, "XYZ", "Bob"
          3, "", ""
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });

    test('- should validate UTF-8 byte length correctly', () => {
      const source = `
        Table messages {
          id int
          text varchar(20)
          short varchar(10)
        }
        records messages(id, text, short) {
          1, "Hello", "Test"
          2, "😀😁😂😃😄", "😀😁😂"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      // "😀😁😂😃😄" is 5 emojis × 4 bytes = 20 bytes (valid)
      // "😀😁😂" is 3 emojis × 4 bytes = 12 bytes (exceeds 10)
      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(1);
      expect(warnings[0].diagnostic).toContain('exceeds maximum length: expected at most 10 bytes');
    });

    test('- should allow unlimited length for text and varchar without parameters', () => {
      const source = `
        Table articles {
          id int
          content text
          description varchar
        }
        records articles(id, content, description) {
          1, "This is a very long text content that can be arbitrarily long without any length restrictions because text type does not have a length parameter", "This is a very long description that can be arbitrarily long"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(0);
    });
  });

  describe('null and empty field handling', () => {
    test('- should handle null keyword and empty fields for all types', () => {
      const source = `
        Table data {
          id int
          count int
          active boolean
          created_at timestamp
          amount decimal
          name varchar
          description text
        }
        records data(id, count, active, created_at, amount, name, description) {
          1, null, null, null, null, null, null
          2, , , , , ,
          3, 10, true, "2024-01-15T10:30:00+07:00", 99.99, "test", "content"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      // Row 1: explicit null keyword
      expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][2]).toEqual({ type: 'bool', value: null });
      expect(db.records[0].values[0][3]).toEqual({ type: 'datetime', value: null });
      expect(db.records[0].values[0][4]).toEqual({ type: 'real', value: null });
      expect(db.records[0].values[0][5]).toEqual({ type: 'string', value: null });
      expect(db.records[0].values[0][6]).toEqual({ type: 'string', value: null });

      // Row 2: empty fields (treated as null)
      expect(db.records[0].values[1][1]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[1][2]).toEqual({ type: 'bool', value: null });
      expect(db.records[0].values[1][3]).toEqual({ type: 'datetime', value: null });
      expect(db.records[0].values[1][4]).toEqual({ type: 'real', value: null });
      expect(db.records[0].values[1][5]).toEqual({ type: 'string', value: null });
      expect(db.records[0].values[1][6]).toEqual({ type: 'string', value: null });

      // Row 3: valid values
      expect(db.records[0].values[2][1]).toEqual({ type: 'integer', value: 10 });
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

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][2]).toEqual({ type: 'bool', value: null });
      expect(db.records[0].values[0][3]).toEqual({ type: 'string', value: '' });
    });
  });

  describe('null constraint validation', () => {
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
          status varchar [not null]
        }
        records users(id, name, status) {
          1, null, NULL
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(2);
      expect(warnings[0].diagnostic).toBe("NULL not allowed for non-nullable column 'name' without default and increment");
      expect(warnings[1].diagnostic).toBe("NULL not allowed for non-nullable column 'status' without default and increment");
    });

    test('- should allow NULL for NOT NULL column with default or increment', () => {
      const source = `
        Table users {
          id int [pk, increment]
          status varchar [not null, default: 'active']
        }
        records users(id, status) {
          null, null
          null, "inactive"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);

      const db = result.getValue()!;
      expect(db.records[0].values.length).toBe(2);
      expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: null });
      expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: null });
      expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'inactive' });
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
      expect(db.records[0].values[0][1].value).toBe('2024-01-15T10:30:00+07:00');
      expect(db.records[0].values[0][2].type).toBe('date');
      expect(db.records[0].values[0][2].value).toBe('2024-01-15');
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

  describe('enum type validation', () => {
    test('- should accept valid enum values with both enum access and string literal', () => {
      const source = `
        Enum status {
          active
          inactive
          pending
        }
        Table users {
          id int [pk]
          status status
        }
        records users(id, status) {
          1, status.active
          2, "inactive"
          3, status.pending
          4, null
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('- should detect invalid enum values', () => {
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
          status status
          role role
        }
        records users(id, status, role) {
          1, "active", "admin"
          2, status.invalid, "user"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      // Enum access with invalid value produces a BINDING_ERROR
      expect(errors.length).toBeGreaterThan(0);
      const bindingErrors = errors.filter((e) => e.code === CompileErrorCode.BINDING_ERROR);
      expect(bindingErrors.length).toBeGreaterThan(0);
      expect(bindingErrors.some((e) => e.diagnostic.includes('invalid'))).toBe(true);
    });

    test('- should validate schema-qualified enums', () => {
      const source = `
        Enum auth.role {
          admin
          user
        }
        Enum app.status {
          active
          inactive
        }
        Table auth.users {
          id int [pk]
          role auth.role
          status app.status
        }
        records auth.users(id, role, status) {
          1, auth.role.admin, "active"
          2, auth.role.user, app.status.inactive
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();

      expect(errors.length).toBe(0);
    });

    test('- should reject unqualified access for schema-qualified enum', () => {
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

      expect(errors.length).toBe(1);
      expect(errors[0].code).toBe(CompileErrorCode.BINDING_ERROR);
      expect(errors[0].diagnostic).toContain('status');
    });

    test('- should handle enum with numeric value rejection', () => {
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

    test('- should validate enum from table partial', () => {
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

  describe('comprehensive edge cases', () => {
    test('- should validate multiple errors in one record across different types', () => {
      const source = `
        Enum status {
          active
          inactive
        }
        Table users {
          id int
          quantity int
          name varchar(5)
          price decimal(5, 2)
          active boolean
          status status
        }
        records users(id, quantity, name, price, active, status) {
          "invalid", 10.5, "VeryLongName", 12345.67, "not_bool", "invalid_status"
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(6);
      expect(warnings[0].diagnostic).toBe("Invalid numeric value for column 'id'");
      expect(warnings[1].diagnostic).toBe("Invalid integer value 10.5 for column 'quantity': expected integer, got decimal");
      expect(warnings[2].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 12 bytes");
      expect(warnings[3].diagnostic).toBe("Numeric value 12345.67 for column 'price' exceeds precision: expected at most 5 total digits, got 7");
      expect(warnings[4].diagnostic).toBe("Invalid boolean value for column 'active'");
      expect(warnings[5].diagnostic).toBe("Invalid enum value for column 'status'");
    });

    test('- should validate across multiple records', () => {
      const source = `
        Table users {
          id int
          name varchar(5)
          quantity int
        }
        records users(id, name, quantity) {
          1, "Alice", 10
          2, "Bob", 20
          3, "Christopher", 30.5
          4, "Dave", 40
          5, "Elizabeth", 50
        }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      const warnings = result.getWarnings();

      expect(errors.length).toBe(0);
      expect(warnings.length).toBe(3);
      expect(warnings[0].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 11 bytes");
      expect(warnings[1].diagnostic).toBe("Invalid integer value 30.5 for column 'quantity': expected integer, got decimal");
      expect(warnings[2].diagnostic).toBe("String value for column 'name' exceeds maximum length: expected at most 5 bytes (UTF-8), got 9 bytes");
    });
  });
});
