import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

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
