import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/index';

describe('[example - record] composite primary key constraints', () => {
  test('should accept valid unique composite primary key values', () => {
    const source = `
      Table order_items {
        order_id int
        product_id int
        quantity int

        indexes {
          (order_id, product_id) [pk]
        }
      }
      records order_items(order_id, product_id, quantity) {
        1, 100, 2
        1, 101, 1
        2, 100, 3
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('order_items');
    expect(db.records[0].columns).toEqual(['order_id', 'product_id', 'quantity']);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: order_id=1, product_id=100, quantity=2
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: 100 });
    expect(db.records[0].values[0][2]).toEqual({ type: 'integer', value: 2 });

    // Row 2: order_id=1, product_id=101, quantity=1
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'integer', value: 101 });
    expect(db.records[0].values[1][2]).toEqual({ type: 'integer', value: 1 });

    // Row 3: order_id=2, product_id=100, quantity=3
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'integer', value: 100 });
    expect(db.records[0].values[2][2]).toEqual({ type: 'integer', value: 3 });
  });

  test('should reject duplicate composite primary key values', () => {
    const source = `
      Table order_items {
        order_id int
        product_id int
        quantity int

        indexes {
          (order_id, product_id) [pk]
        }
      }
      records order_items(order_id, product_id, quantity) {
        1, 100, 2
        1, 100, 5
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('Duplicate Composite PK: (order_items.order_id, order_items.product_id) = (1, 100)');
    expect(warnings[1].diagnostic).toBe('Duplicate Composite PK: (order_items.order_id, order_items.product_id) = (1, 100)');
  });

  test('should reject NULL in any column of composite primary key', () => {
    const source = `
      Table order_items {
        order_id int
        product_id int
        quantity int

        indexes {
          (order_id, product_id) [pk]
        }
      }
      records order_items(order_id, product_id, quantity) {
        1, null, 2
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('NULL in Composite PK: (order_items.order_id, order_items.product_id) cannot be NULL');
    expect(warnings[1].diagnostic).toBe('NULL in Composite PK: (order_items.order_id, order_items.product_id) cannot be NULL');
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks for same table', () => {
    const source = `
      Table order_items {
        order_id int
        product_id int
        quantity int

        indexes {
          (order_id, product_id) [pk]
        }
      }
      records order_items(order_id, product_id, quantity) {
        1, 100, 2
      }
      records order_items(order_id, product_id, quantity) {
        1, 100, 5
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'order_items'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'order_items'");
  });

  test('should allow same value in one pk column when other differs', () => {
    const source = `
      Table user_roles {
        user_id int
        role_id int
        assigned_at timestamp

        indexes {
          (user_id, role_id) [pk]
        }
      }
      records user_roles(user_id, role_id, assigned_at) {
        1, 1, "2024-01-01"
        1, 2, "2024-01-02"
        2, 1, "2024-01-03"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: user_id=1, role_id=1, assigned_at="2024-01-01"
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][2].type).toBe('datetime');
    expect(db.records[0].values[0][2].value).toBe('2024-01-01');

    // Row 2: user_id=1, role_id=2, assigned_at="2024-01-02"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][2].type).toBe('datetime');
    expect(db.records[0].values[1][2].value).toBe('2024-01-02');

    // Row 3: user_id=2, role_id=1, assigned_at="2024-01-03"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[2][2].type).toBe('datetime');
    expect(db.records[0].values[2][2].value).toBe('2024-01-03');
  });
});

describe('[example - record] simple primary key constraints', () => {
  test('should accept valid unique primary key values', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        2, "Bob"
        3, "Charlie"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('users');
    expect(db.records[0].columns).toEqual(['id', 'name']);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: id=1, name="Alice"
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Alice' });

    // Row 2: id=2, name="Bob"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Row 3: id=3, name="Charlie"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: 'Charlie' });
  });

  test('should reject duplicate primary key values', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        1, "Bob"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate PK: users.id = 1');
  });

  test('should reject NULL values in primary key column', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        null, "Alice"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('NULL in PK: users.id cannot be NULL');
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks for same table', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
      }
      records users(id, name) {
        1, "Bob"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  test('should report error when pk column is missing from record', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar
      }
      records users(name, email) {
        "Alice", "alice@example.com"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('PK: Column users.id is missing from record and has no default value');
  });

  test('should accept string primary keys', () => {
    const source = `
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      records countries(code, name) {
        "US", "United States"
        "UK", "United Kingdom"
        "CA", "Canada"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0][0]).toEqual({ type: 'string', value: 'US' });
    expect(db.records[0].values[1][0]).toEqual({ type: 'string', value: 'UK' });
    expect(db.records[0].values[2][0]).toEqual({ type: 'string', value: 'CA' });
  });

  test('should reject duplicate string primary keys', () => {
    const source = `
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      records countries(code, name) {
        "US", "United States"
        "US", "USA"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate PK: countries.code = "US"');
  });

  test('should accept primary key alias syntax', () => {
    const source = `
      Table users {
        id int [primary key]
        name varchar
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

  test('should handle zero as valid pk value', () => {
    const source = `
      Table items {
        id int [pk]
        name varchar
      }
      records items(id, name) {
        0, "Zero Item"
        1, "One Item"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 0 });
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 1 });
  });

  test('should handle negative numbers as pk values', () => {
    const source = `
      Table transactions {
        id int [pk]
        amount decimal
      }
      records transactions(id, amount) {
        -1, 100.00
        1, 50.00
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: -1 });
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 1 });
  });

  test('should accept valid pk with auto-increment', () => {
    const source = `
      Table users {
        id int [pk, increment]
        name varchar
      }
      records users(id, name) {
        null, "Alice"
        null, "Bob"
        3, "Charlie"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });
});

describe('[example - record] PK validation across multiple records blocks', () => {
  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar
      }

      records users(id, name) {
        1, 'Alice'
        2, 'Bob'
      }

      records users(id, email) {
        3, 'charlie@example.com'
        4, 'david@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar
      }

      records users(id, name) {
        1, 'Alice'
        2, 'Bob'
      }

      records users(id, email) {
        2, 'bob2@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks with composite PK', () => {
    const source = `
      Table order_items {
        order_id int
        product_id int
        quantity int
        price decimal
        indexes {
          (order_id, product_id) [pk]
        }
      }

      records order_items(order_id, product_id, quantity) {
        1, 100, 2
        1, 101, 1
      }

      records order_items(order_id, product_id, price) {
        2, 100, 50.00
        2, 101, 75.00
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'order_items'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'order_items'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks with composite PK', () => {
    const source = `
      Table order_items {
        order_id int
        product_id int
        quantity int
        indexes {
          (order_id, product_id) [pk]
        }
      }

      records order_items(order_id, product_id, quantity) {
        1, 100, 2
      }

      records order_items(order_id, product_id) {
        1, 100
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'order_items'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'order_items'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks with PK column missing from some blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        bio text
      }

      records users(id, name) {
        1, 'Alice'
      }

      records users(name, bio) {
        'Bob', 'Bio text'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks with NULL PK', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        sku varchar
      }

      records products(id, name) {
        null, 'Product A'
      }

      records products(id, sku) {
        1, 'SKU-001'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'products'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks with auto-increment PK', () => {
    const source = `
      Table users {
        id int [pk, increment]
        name varchar
        email varchar
      }

      records users(id, name) {
        null, 'Alice'
        null, 'Bob'
      }

      records users(id, email) {
        null, 'charlie@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple records blocks with duplicate non-NULL PK', () => {
    const source = `
      Table users {
        id int [pk, increment]
        name varchar
        email varchar
      }

      records users(id, name) {
        1, 'Alice'
      }

      records users(id, email) {
        1, 'alice@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for nested and top-level records', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal

        records (id, name) {
          1, 'Laptop'
        }
      }

      records products(id, price) {
        2, 999.99
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'products'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for PK duplicate between nested and top-level', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar

        records (id) {
          1
        }
      }

      records products(id, name) {
        1, 'Laptop'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'products'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for complex scenario with multiple blocks and mixed columns', () => {
    const source = `
      Table users {
        id int [pk]
        username varchar
        email varchar
        created_at timestamp
      }

      records users(id, username) {
        1, 'alice'
        2, 'bob'
      }

      records users(id, email) {
        3, 'charlie@example.com'
        4, 'david@example.com'
      }

      records users(id, created_at) {
        5, '2024-01-01'
      }

      records users(id, username, email) {
        6, 'eve', 'eve@example.com'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties (4 blocks = 6 errors)
    expect(errors.length).toBe(6);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[2].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[2].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[3].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[3].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[4].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[4].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[5].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[5].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple PK violations across many blocks', () => {
    const source = `
      Table events {
        id int [pk]
        name varchar
        date varchar
        location varchar
      }

      records events(id, name) {
        1, 'Event A'
        2, 'Event B'
      }

      records events(id, date) {
        2, '2024-01-01'
        3, '2024-01-02'
      }

      records events(id, location) {
        1, 'Location A'
        4, 'Location B'
      }
    `;

    const result = interpret(source);
    const errors = result.getErrors();

    // Verify exact error count and ALL error properties (3 blocks = 4 errors)
    expect(errors.length).toBe(4);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'events'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'events'");
    expect(errors[2].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[2].diagnostic).toBe("Duplicate Records for the same Table 'events'");
    expect(errors[3].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[3].diagnostic).toBe("Duplicate Records for the same Table 'events'");
  });
});
