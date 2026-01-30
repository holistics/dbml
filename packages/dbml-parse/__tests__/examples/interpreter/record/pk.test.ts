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
        1, 100, 2
        1, null, 3
        null, 101, 4
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(4);
    expect(warnings[0].diagnostic).toBe('NULL in Composite PK: (order_items.order_id, order_items.product_id) cannot be NULL');
    expect(warnings[1].diagnostic).toBe('NULL in Composite PK: (order_items.order_id, order_items.product_id) cannot be NULL');
    expect(warnings[2].diagnostic).toBe('NULL in Composite PK: (order_items.order_id, order_items.product_id) cannot be NULL');
    expect(warnings[3].diagnostic).toBe('NULL in Composite PK: (order_items.order_id, order_items.product_id) cannot be NULL');
  });
});

describe('[example - record] simple primary key constraints', () => {
  test('should validate PK with various data types and values', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      Table accounts {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }
      records countries(code, name) {
        "US", "United States"
        "UK", "United Kingdom"
      }
      records accounts(id, name) {
        0, "Default Account"
        1, "User Account"
        2, "Business Account"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue();
    if (!db || !db.records) {
      const errors = result.getErrors();
      console.error('Compilation errors:', errors.map((e) => e.diagnostic));
      throw new Error('Failed to compile DBML source');
    }
    expect(db.records).toBeDefined();
    expect(db.records.length).toBe(3);

    // Verify users table
    const usersRecord = db.records.find((r) => r.tableName === 'users');
    expect(usersRecord).toBeDefined();
    expect(usersRecord!.values.length).toBe(2);
    expect(usersRecord!.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(usersRecord!.values[0][1]).toEqual({ type: 'string', value: 'Alice' });
    expect(usersRecord!.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(usersRecord!.values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Verify countries table with string PK
    const countriesRecord = db.records.find((r) => r.tableName === 'countries');
    expect(countriesRecord).toBeDefined();
    expect(countriesRecord!.values.length).toBe(2);
    expect(countriesRecord!.values[0][0]).toEqual({ type: 'string', value: 'US' });
    expect(countriesRecord!.values[1][0]).toEqual({ type: 'string', value: 'UK' });

    // Verify accounts table with zero PK
    const accountsRecord = db.records.find((r) => r.tableName === 'accounts');
    expect(accountsRecord).toBeDefined();
    expect(accountsRecord!.values.length).toBe(3);
    expect(accountsRecord!.values[0][0]).toEqual({ type: 'integer', value: 0 });
    expect(accountsRecord!.values[1][0]).toEqual({ type: 'integer', value: 1 });
    expect(accountsRecord!.values[2][0]).toEqual({ type: 'integer', value: 2 });
  });

  test('should reject duplicate PK values', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        1, "Bob"
      }
      records countries(code, name) {
        "US", "United States"
        "US", "USA"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    // Should have warnings for duplicate PKs
    expect(warnings.length).toBeGreaterThan(0);

    // Verify users.id duplicate warnings
    const userWarnings = warnings.filter((w) => w.diagnostic.includes('users.id'));
    expect(userWarnings.length).toBeGreaterThan(0);
    expect(userWarnings.every((w) => w.diagnostic.includes('Duplicate PK'))).toBe(true);

    // Verify countries.code duplicate warnings
    const countryWarnings = warnings.filter((w) => w.diagnostic.includes('countries.code'));
    expect(countryWarnings.length).toBeGreaterThan(0);
    expect(countryWarnings.every((w) => w.diagnostic.includes('Duplicate PK'))).toBe(true);
  });

  test('should reject NULL PK values', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      records users(id, name) {
        1, "Alice"
        null, "Bob"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('NULL in PK: users.id cannot be NULL');
  });

  test('should validate PK alias syntax (primary key)', () => {
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

    const db = result.getValue()!;
    expect(db.records[0].values.length).toBe(2);
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
  });

  test('should validate auto-increment PK values', () => {
    const source = `
      Table users {
        id int [pk, increment]
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
    expect(db.records[0].values.length).toBe(3);
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 3 });
  });

  test('should report error for duplicate records blocks', () => {
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
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'users'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'users'");
  });
});
