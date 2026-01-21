import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

describe('[example - record] Constraints in table partials', () => {
  describe('Primary Key', () => {
    test('should validate PK from injected table partial', () => {
      const source = `
        TablePartial id_partial {
          id int [pk]
        }

        Table users {
          name varchar
          ~id_partial
        }

        records users(id, name) {
          1, "Alice"
          2, "Bob"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should detect duplicate PK from injected table partial', () => {
      const source = `
        TablePartial id_partial {
          id int [pk]
        }

        Table users {
          name varchar
          ~id_partial
        }

        records users(id, name) {
          1, "Alice"
          1, "Bob"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe('Duplicate PK: users.id = 1');
    });

    test('should validate composite PK from injected table partial', () => {
      const source = `
        TablePartial region_id {
          country_code varchar [pk]
          region_code varchar [pk]
        }

        Table regions {
          name varchar
          ~region_id
        }

        records regions(country_code, region_code, name) {
          "US", "CA", "California"
          "US", "NY", "New York"
          "CA", "BC", "British Columbia"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should detect duplicate composite PK from injected table partial', () => {
      const source = `
        TablePartial region_id {
          country_code varchar [pk]
          region_code varchar [pk]
        }

        Table regions {
          name varchar
          ~region_id
        }

        records regions(country_code, region_code, name) {
          "US", "CA", "California"
          "US", "CA", "California Duplicate"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(2);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe('Duplicate Composite PK: (regions.country_code, regions.region_code) = ("US", "CA")');
      expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[1].diagnostic).toBe('Duplicate Composite PK: (regions.country_code, regions.region_code) = ("US", "CA")');
    });

    test('should detect NULL in PK from injected table partial', () => {
      const source = `
        TablePartial id_partial {
          id int [pk]
        }

        Table users {
          name varchar
          ~id_partial
        }

        records users(id, name) {
          1, "Alice"
          null, "Bob"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe('NULL in PK: users.id cannot be NULL');
    });
  });

  describe('UNIQUE constraint', () => {
    test('should validate UNIQUE constraint from injected table partial', () => {
      const source = `
        TablePartial unique_email {
          email varchar [unique]
        }

        Table users {
          id int [pk]
          name varchar
          ~unique_email
        }

        records users(id, name, email) {
          1, "Alice", "alice@example.com"
          2, "Bob", "bob@example.com"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should detect UNIQUE violation from injected table partial', () => {
      const source = `
        TablePartial unique_email {
          email varchar [unique]
        }

        Table users {
          id int [pk]
          name varchar
          ~unique_email
        }

        records users(id, name, email) {
          1, "Alice", "alice@example.com"
          2, "Bob", "alice@example.com"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(1);
      expect(warnings[0].diagnostic).toBe('Duplicate UNIQUE: users.email = "alice@example.com"');
    });

    test('should allow NULL in UNIQUE columns from partial', () => {
      const source = `
        TablePartial unique_email {
          email varchar [unique]
        }

        Table users {
          id int [pk]
          name varchar
          ~unique_email
        }

        records users(id, name, email) {
          1, "Alice", "alice@example.com"
          2, "Bob", null
          3, "Charlie", null
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should validate multiple UNIQUE constraints from different partials', () => {
      const source = `
        TablePartial unique_email {
          email varchar [unique]
        }

        TablePartial unique_username {
          username varchar [unique]
        }

        Table users {
          id int [pk]
          name varchar
          ~unique_email
          ~unique_username
        }

        records users(id, name, email, username) {
          1, "Alice", "alice@example.com", "alice123"
          2, "Bob", "bob@example.com", "bob456"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should detect UNIQUE violations from multiple partials', () => {
      const source = `
        TablePartial unique_email {
          email varchar [unique]
        }

        TablePartial unique_username {
          username varchar [unique]
        }

        Table users {
          id int [pk]
          name varchar
          ~unique_email
          ~unique_username
        }

        records users(id, name, email, username) {
          1, "Alice", "alice@example.com", "alice123"
          2, "Bob", "alice@example.com", "bob456"
          3, "Charlie", "charlie@example.com", "alice123"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(2);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      // One error for email, one for username
      const errorMessages = warnings.map((e) => e.diagnostic);
      expect(errorMessages.some((msg) => msg.includes('email'))).toBe(true);
      expect(errorMessages.some((msg) => msg.includes('username'))).toBe(true);
    });

    test('should validate UNIQUE with table indexes from partial', () => {
      const source = `
        TablePartial indexed_fields {
          field1 varchar
          field2 varchar
          indexes {
            (field1, field2) [unique]
          }
        }

        Table data {
          id int [pk]
          ~indexed_fields
        }

        records data(id, field1, field2) {
          1, "a", "x"
          2, "a", "y"
          3, "b", "x"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should detect UNIQUE index violation from partial', () => {
      const source = `
        TablePartial indexed_fields {
          field1 varchar
          field2 varchar
          indexes {
            (field1, field2) [unique]
          }
        }

        Table data {
          id int [pk]
          ~indexed_fields
        }

        records data(id, field1, field2) {
          1, "a", "x"
          2, "a", "x"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(2);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe('Duplicate Composite UNIQUE: (data.field1, data.field2) = ("a", "x")');
      expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[1].diagnostic).toBe('Duplicate Composite UNIQUE: (data.field1, data.field2) = ("a", "x")');
    });
  });

  describe('NOT NULL constraint', () => {
    test('should validate NOT NULL constraint from injected table partial', () => {
      const source = `
        TablePartial required_fields {
          email varchar [not null]
        }

        Table users {
          id int [pk]
          name varchar
          ~required_fields
        }

        records users(id, name, email) {
          1, "Alice", "alice@example.com"
          2, "Bob", "bob@example.com"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should detect NOT NULL violation from injected table partial', () => {
      const source = `
        TablePartial required_fields {
          email varchar [not null]
        }

        Table users {
          id int [pk]
          name varchar
          ~required_fields
        }

        records users(id, name, email) {
          1, "Alice", "alice@example.com"
          2, "Bob", null
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(1);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[0].diagnostic).toBe("NULL not allowed for non-nullable column 'email' without default and increment");
    });

    test('should validate multiple NOT NULL constraints from partial', () => {
      const source = `
        TablePartial required_fields {
          email varchar [not null]
          phone varchar [not null]
        }

        Table users {
          id int [pk]
          name varchar
          ~required_fields
        }

        records users(id, name, email, phone) {
          1, "Alice", "alice@example.com", "555-1234"
          2, "Bob", "bob@example.com", "555-5678"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should detect multiple NOT NULL violations from partial', () => {
      const source = `
        TablePartial required_fields {
          email varchar [not null]
          phone varchar [not null]
        }

        Table users {
          id int [pk]
          name varchar
          ~required_fields
        }

        records users(id, name, email, phone) {
          1, "Alice", "alice@example.com", "555-1234"
          2, "Bob", null, "555-5678"
          3, "Charlie", "charlie@example.com", null
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(2);
      expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
      // Both warnings should be about NULL not allowed
      const warningMessages = warnings.map((e) => e.diagnostic);
      expect(warningMessages.every((msg) => msg.includes('NULL not allowed'))).toBe(true);
    });

    test('should allow nullable columns from partial when not marked as NOT NULL', () => {
      const source = `
        TablePartial optional_fields {
          middle_name varchar
          nickname varchar
        }

        Table users {
          id int [pk]
          first_name varchar [not null]
          last_name varchar [not null]
          ~optional_fields
        }

        records users(id, first_name, last_name, middle_name, nickname) {
          1, "Alice", "Smith", "Jane", "Ali"
          2, "Bob", "Jones", null, null
          3, "Charlie", "Brown", "Robert", null
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });
  });

  describe('Mixed constraints from table and partials', () => {
    test('should validate mixed constraints from table and multiple partials', () => {
      const source = `
        TablePartial id_partial {
          id int [pk]
        }

        TablePartial unique_email {
          email varchar [unique]
        }

        TablePartial required_phone {
          phone varchar [not null]
        }

        Table users {
          name varchar [not null]
          ~id_partial
          ~unique_email
          ~required_phone
        }

        records users(id, name, email, phone) {
          1, "Alice", "alice@example.com", "555-1234"
          2, "Bob", "bob@example.com", "555-5678"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      expect(warnings.length).toBe(0);
    });

    test('should detect mixed constraint violations from table and partials', () => {
      const source = `
        TablePartial id_partial {
          id int [pk]
        }

        TablePartial unique_email {
          email varchar [unique]
        }

        TablePartial required_phone {
          phone varchar [not null]
        }

        Table users {
          name varchar [not null]
          ~id_partial
          ~unique_email
          ~required_phone
        }

        records users(id, name, email, phone) {
          1, "Alice", "alice@example.com", "555-1234"
          1, "Bob", "alice@example.com", null
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      // Should detect: duplicate PK (id - warning), duplicate UNIQUE (email - warning), NOT NULL (phone - warning)
      expect(warnings.length).toBe(3);
      expect(warnings.every((e) => e.code === CompileErrorCode.INVALID_RECORDS_FIELD)).toBe(true);
      const errorMessages = warnings.map((e) => e.diagnostic);
      expect(errorMessages.some((msg) => msg.includes('Duplicate PK'))).toBe(true);
      expect(errorMessages.some((msg) => msg.includes('Duplicate UNIQUE'))).toBe(true);
      expect(errorMessages.some((msg) => msg.includes('NULL not allowed'))).toBe(true);
    });
  });

  describe('Constraints when partial injected into multiple tables', () => {
    test('should validate constraints independently for each table', () => {
      const source = `
        TablePartial id_and_email {
          id int [pk]
          email varchar [unique, not null]
        }

        Table users {
          name varchar
          ~id_and_email
        }

        Table admins {
          role varchar
          ~id_and_email
        }

        records users(id, name, email) {
          1, "Alice", "alice@example.com"
          2, "Bob", "bob@example.com"
        }

        records admins(id, role, email) {
          1, "Admin", "admin@example.com"
          2, "Super", "super@example.com"
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      // Same IDs and emails across different tables are allowed
      expect(warnings.length).toBe(0);
    });

    test('should detect constraint violations independently in each table', () => {
      const source = `
        TablePartial id_and_email {
          id int [pk]
          email varchar [unique, not null]
        }

        Table users {
          name varchar
          ~id_and_email
        }

        Table admins {
          role varchar
          ~id_and_email
        }

        records users(id, name, email) {
          1, "Alice", "alice@example.com"
        }

        records admins(id, role, email) {
          1, "Admin", "admin@example.com"
          1, "Duplicate ID", "duplicate@example.com"
          2, "Super", "admin@example.com"
          3, "Invalid", null
        }
      `;
      const result = interpret(source);
      const warnings = result.getWarnings();

      // Should have warnings in admins table: duplicate PK, duplicate UNIQUE, NOT NULL
      expect(warnings.length).toBe(3);
      expect(warnings.every((e) => e.code === CompileErrorCode.INVALID_RECORDS_FIELD)).toBe(true);
      const errorMessages = warnings.map((e) => e.diagnostic);
      expect(errorMessages.some((msg) => msg.includes('Duplicate PK'))).toBe(true);
      expect(errorMessages.some((msg) => msg.includes('Duplicate UNIQUE'))).toBe(true);
      expect(errorMessages.some((msg) => msg.includes('NULL not allowed'))).toBe(true);
    });
  });
});
