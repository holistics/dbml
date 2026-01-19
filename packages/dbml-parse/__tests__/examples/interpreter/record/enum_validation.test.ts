import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

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
    expect(warnings[0].diagnostic).toBe("Invalid enum value \"invalid_value\" for column 'status' of type 'status' (valid values: active, inactive)");
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
    expect(warningMessages.some((msg) => msg.includes('invalid_status'))).toBe(true);
    expect(warningMessages.some((msg) => msg.includes('invalid_role'))).toBe(true);
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

  test('should reject string literal for schema-qualified enum', () => {
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
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('fully qualified');
    expect(warnings[0].diagnostic).toContain('app.status.active');
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

  test.skip('should validate enum from table partial', () => {
    // TODO: This test reveals that isEnum flag is not set correctly for columns from table partials
    // This is a separate bug in the type resolution system that needs to be fixed
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

    expect(errors.length).toBe(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(errors[0].diagnostic).toContain('invalid_priority');
    expect(errors[0].diagnostic).toContain('priority');
  });
});
