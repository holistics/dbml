import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/index';

describe('[example - record] composite unique constraints', () => {
  test('should accept valid unique composite values', () => {
    const source = `
      Table user_profiles {
        user_id int
        profile_type varchar
        data text

        indexes {
          (user_id, profile_type) [unique]
        }
      }
      records user_profiles(user_id, profile_type, data) {
        1, "work", "Software Engineer"
        1, "personal", "Loves hiking"
        2, "work", "Designer"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('user_profiles');
    expect(db.records[0].columns).toEqual(['user_id', 'profile_type', 'data']);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: user_id=1, profile_type="work", data="Software Engineer"
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'work' });
    expect(db.records[0].values[0][2]).toEqual({ type: 'string', value: 'Software Engineer' });

    // Row 2: user_id=1, profile_type="personal", data="Loves hiking"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'personal' });
    expect(db.records[0].values[1][2]).toEqual({ type: 'string', value: 'Loves hiking' });

    // Row 3: user_id=2, profile_type="work", data="Designer"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: 'work' });
    expect(db.records[0].values[2][2]).toEqual({ type: 'string', value: 'Designer' });
  });

  test('should reject duplicate composite unique values', () => {
    const source = `
      Table user_profiles {
        user_id int
        profile_type varchar
        data text

        indexes {
          (user_id, profile_type) [unique]
        }
      }
      records user_profiles(user_id, profile_type, data) {
        1, "work", "Software Engineer"
        1, "work", "Updated job title"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('Duplicate Composite UNIQUE: (user_profiles.user_id, user_profiles.profile_type) = (1, "work")');
    expect(warnings[1].diagnostic).toBe('Duplicate Composite UNIQUE: (user_profiles.user_id, user_profiles.profile_type) = (1, "work")');
  });

  test('should allow NULL values in composite unique (NULLs dont conflict)', () => {
    const source = `
      Table user_settings {
        user_id int
        category varchar
        value varchar

        indexes {
          (user_id, category) [unique]
        }
      }
      records user_settings(user_id, category, value) {
        1, null, "default"
        1, null, "another default"
        1, "theme", "dark"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values.length).toBe(3);

    // Row 1: user_id=1, category=null, value="default"
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1].value).toBe(null);
    expect(db.records[0].values[0][2]).toEqual({ type: 'string', value: 'default' });

    // Row 2: user_id=1, category=null, value="another default"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1][1].value).toBe(null);
    expect(db.records[0].values[1][2]).toEqual({ type: 'string', value: 'another default' });

    // Row 3: user_id=1, category="theme", value="dark"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: 'theme' });
    expect(db.records[0].values[2][2]).toEqual({ type: 'string', value: 'dark' });
  });

  test('should allow same value in one unique column when other differs', () => {
    const source = `
      Table event_registrations {
        event_id int
        attendee_id int
        registration_date timestamp

        indexes {
          (event_id, attendee_id) [unique]
        }
      }
      records event_registrations(event_id, attendee_id, registration_date) {
        1, 100, "2024-01-01"
        1, 101, "2024-01-02"
        2, 100, "2024-01-03"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values.length).toBe(3);

    // Row 1: event_id=1, attendee_id=100, registration_date="2024-01-01"
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: 100 });
    expect(db.records[0].values[0][2].type).toBe('datetime');
    expect(db.records[0].values[0][2].value).toBe('2024-01-01');

    // Row 2: event_id=1, attendee_id=101, registration_date="2024-01-02"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'integer', value: 101 });
    expect(db.records[0].values[1][2].type).toBe('datetime');
    expect(db.records[0].values[1][2].value).toBe('2024-01-02');

    // Row 3: event_id=2, attendee_id=100, registration_date="2024-01-03"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'integer', value: 100 });
    expect(db.records[0].values[2][2].type).toBe('datetime');
    expect(db.records[0].values[2][2].value).toBe('2024-01-03');
  });
});

describe('[example - record] simple unique constraints', () => {
  test('should validate unique constraints with various data types', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
      }
      Table products {
        id int [pk]
        sku varchar [unique]
      }
      Table accounts {
        id int [pk]
        account_number int [unique]
      }
      records users(id, email, username) {
        1, "alice@example.com", "alice"
        2, "bob@example.com", "bob"
      }
      records products(id, sku) {
        1, "PROD-001"
        2, "PROD-002"
      }
      records accounts(id, account_number) {
        1, 0
        2, -1
        3, 1000
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(3);

    // Verify users table
    expect(db.records[0].tableName).toBe('users');
    expect(db.records[0].values.length).toBe(2);
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'alice@example.com' });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'bob@example.com' });

    // Verify products table
    expect(db.records[1].tableName).toBe('products');
    expect(db.records[1].values.length).toBe(2);
    expect(db.records[1].values[0][1]).toEqual({ type: 'string', value: 'PROD-001' });

    // Verify accounts table with numeric unique values including zero and negative
    expect(db.records[2].tableName).toBe('accounts');
    expect(db.records[2].values.length).toBe(3);
    expect(db.records[2].values[0][1]).toEqual({ type: 'integer', value: 0 });
    expect(db.records[2].values[1][1]).toEqual({ type: 'integer', value: -1 });
    expect(db.records[2].values[2][1]).toEqual({ type: 'integer', value: 1000 });
  });

  test('should reject duplicate unique values', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }
      Table products {
        id int [pk]
        sku varchar [unique]
      }
      records users(id, email) {
        1, "alice@example.com"
        2, "alice@example.com"
      }
      records products(id, sku) {
        1, "PROD-001"
        2, "PROD-001"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    // Should have warnings for duplicate unique values
    expect(warnings.length).toBeGreaterThan(0);

    // Verify users.email duplicate warnings
    const userWarnings = warnings.filter((w) => w.diagnostic.includes('users.email') && w.diagnostic.includes('alice@example.com'));
    expect(userWarnings.length).toBeGreaterThan(0);
    expect(userWarnings.every((w) => w.diagnostic.includes('Duplicate UNIQUE'))).toBe(true);

    // Verify products.sku duplicate warnings
    const productWarnings = warnings.filter((w) => w.diagnostic.includes('products.sku') && w.diagnostic.includes('PROD-001'));
    expect(productWarnings.length).toBeGreaterThan(0);
    expect(productWarnings.every((w) => w.diagnostic.includes('Duplicate UNIQUE'))).toBe(true);
  });

  test('should allow multiple NULL values in unique columns', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        phone varchar [unique]
      }
      records users(id, email, phone) {
        1, "alice@example.com", null
        2, "bob@example.com", null
        3, null, "123-456"
        4, null, "789-012"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values.length).toBe(4);

    // Row 1: email="alice@example.com", phone=null
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'alice@example.com' });
    expect(db.records[0].values[0][2].value).toBe(null);

    // Row 2: email="bob@example.com", phone=null
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'bob@example.com' });
    expect(db.records[0].values[1][2].value).toBe(null);

    // Row 3: email=null, phone="123-456"
    expect(db.records[0].values[2][1].value).toBe(null);
    expect(db.records[0].values[2][2]).toEqual({ type: 'string', value: '123-456' });

    // Row 4: email=null, phone="789-012"
    expect(db.records[0].values[3][1].value).toBe(null);
    expect(db.records[0].values[3][2]).toEqual({ type: 'string', value: '789-012' });
  });

  test('should validate unique with PK constraint', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }
      records users(id, email) {
        1, "alice@example.com"
        1, "bob@example.com"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    // Should have warnings for duplicate PK
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.every((w) => w.diagnostic.includes('Duplicate PK') && w.diagnostic.includes('users.id'))).toBe(true);
  });

  test('should validate multiple unique columns on same table', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
        phone varchar [unique]
      }
      records users(id, email, username, phone) {
        1, "alice@example.com", "alice", "111-111"
        2, "bob@example.com", "bob", "222-222"
        3, "charlie@example.com", "alice", "333-333"
        4, "dave@example.com", "dave", "111-111"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    // username "alice" is duplicate (rows 1 and 3) and phone "111-111" is duplicate (rows 1 and 4)
    // Each duplicate generates one warning per affected row
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((w) => w.diagnostic.includes('users.username') && w.diagnostic.includes('alice'))).toBe(true);
    expect(warnings.some((w) => w.diagnostic.includes('users.phone') && w.diagnostic.includes('111-111'))).toBe(true);
  });

  test('should report error for duplicate records blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }

      records users(id, email) {
        1, "alice@example.com"
      }
      records users(id, email) {
        2, "bob@example.com"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records blocks for the same Table 'users' - A Table can only have one Records block");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records blocks for the same Table 'users' - A Table can only have one Records block");
  });
});
