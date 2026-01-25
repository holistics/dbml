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

  test('should detect duplicate composite unique across multiple records blocks', () => {
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
        1, "work", "Engineer"
      }
      records user_profiles(user_id, profile_type, data) {
        1, "work", "Developer"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('Duplicate Composite UNIQUE: (user_profiles.user_id, user_profiles.profile_type) = (1, "work")');
    expect(warnings[1].diagnostic).toBe('Duplicate Composite UNIQUE: (user_profiles.user_id, user_profiles.profile_type) = (1, "work")');
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
  test('should accept valid unique values', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }
      records users(id, email) {
        1, "alice@example.com"
        2, "bob@example.com"
        3, "charlie@example.com"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('users');
    expect(db.records[0].columns).toEqual(['id', 'email']);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: id=1, email="alice@example.com"
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'alice@example.com' });

    // Row 2: id=2, email="bob@example.com"
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'bob@example.com' });

    // Row 3: id=3, email="charlie@example.com"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: 'charlie@example.com' });
  });

  test('should reject duplicate unique values', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }
      records users(id, email) {
        1, "alice@example.com"
        2, "alice@example.com"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate UNIQUE: users.email = "alice@example.com"');
  });

  test('should allow NULL values in unique column (NULLs dont conflict)', () => {
    const source = `
      Table users {
        id int [pk]
        phone varchar [unique]
      }
      records users(id, phone) {
        1, null
        2, ""
        3, "555-1234"
        4,
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values.length).toBe(4);

    // Row 1: id=1, phone=null
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: null });

    // Row 2: id=2, phone=null
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: '' });

    // Row 3: id=3, phone="555-1234"
    expect(db.records[0].values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'string', value: '555-1234' });

    // Row 4: id=4, phone=null
    expect(db.records[0].values[3][0]).toEqual({ type: 'integer', value: 4 });
    expect(db.records[0].values[3][1]).toEqual({ type: 'string', value: null });
  });

  test('should detect duplicate unique across multiple records blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
      }
      records users(id, email) {
        1, "alice@example.com"
      }
      records users(id, email) {
        2, "alice@example.com"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate UNIQUE: users.email = "alice@example.com"');
  });

  test('should validate multiple unique columns independently', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
      }
      records users(id, email, username) {
        1, "alice@example.com", "alice"
        2, "bob@example.com", "alice"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate UNIQUE: users.username = "alice"');
  });

  test('should accept unique constraint with numeric values', () => {
    const source = `
      Table products {
        id int [pk]
        sku int [unique]
        name varchar
      }
      records products(id, sku, name) {
        1, 1001, "Product A"
        2, 1002, "Product B"
        3, 1003, "Product C"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: 1001 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'integer', value: 1002 });
    expect(db.records[0].values[2][1]).toEqual({ type: 'integer', value: 1003 });
  });

  test('should reject duplicate numeric unique values', () => {
    const source = `
      Table products {
        id int [pk]
        sku int [unique]
        name varchar
      }
      records products(id, sku, name) {
        1, 1001, "Product A"
        2, 1001, "Product B"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate UNIQUE: products.sku = 1001');
  });

  test('should accept zero as unique value', () => {
    const source = `
      Table items {
        id int [pk]
        code int [unique]
      }
      records items(id, code) {
        1, 0
        2, 1
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should handle negative numbers in unique constraint', () => {
    const source = `
      Table balances {
        id int [pk]
        account_num int [unique]
      }
      records balances(id, account_num) {
        1, -100
        2, 100
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: -100 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'integer', value: 100 });
  });

  test('should accept both pk and unique on same column', () => {
    const source = `
      Table items {
        id int [pk, unique]
        name varchar
      }
      records items(id, name) {
        1, "Item 1"
        2, "Item 2"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should reject duplicate when column has both pk and unique', () => {
    const source = `
      Table items {
        id int [pk, unique]
        name varchar
      }
      records items(id, name) {
        1, "Item 1"
        1, "Item 2"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    // Both pk and unique violations are reported
    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('Duplicate PK: items.id = 1');
    expect(warnings[1].diagnostic).toBe('Duplicate UNIQUE: items.id = 1');
  });

  test('should allow all null values in unique column', () => {
    const source = `
      Table data {
        id int [pk]
        optional_code varchar [unique]
      }
      records data(id, optional_code) {
        1, null
        2, null
        3, null
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });
});

describe('[example - record] Unique validation across multiple records blocks', () => {
  test('should validate unique constraint across blocks with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
      }

      records users(id, email) {
        1, 'alice@example.com'
        2, 'bob@example.com'
      }

      records users(id, username) {
        3, 'charlie'
        4, 'david'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect unique violation across blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        name varchar
      }

      records users(id, email) {
        1, 'alice@example.com'
      }

      records users(id, email, name) {
        2, 'alice@example.com', 'Alice2'  // Duplicate email
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('Duplicate UNIQUE');
  });

  test('should validate composite unique across multiple blocks', () => {
    const source = `
      Table user_roles {
        id int [pk]
        user_id int
        role_id int
        granted_by int
        indexes {
          (user_id, role_id) [unique]
        }
      }

      records user_roles(id, user_id, role_id) {
        1, 100, 1
        2, 100, 2
      }

      records user_roles(id, user_id, role_id, granted_by) {
        3, 101, 1, 999
        4, 102, 1, 999
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect composite unique violation across blocks', () => {
    const source = `
      Table user_roles {
        id int [pk]
        user_id int
        role_id int
        indexes {
          (user_id, role_id) [unique]
        }
      }

      records user_roles(id, user_id, role_id) {
        1, 100, 1
      }

      records user_roles(id, user_id, role_id) {
        2, 100, 1  // Duplicate (100, 1)
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toContain('Duplicate Composite UNIQUE');
    expect(warnings[1].diagnostic).toContain('Duplicate Composite UNIQUE');
  });

  test('should allow NULL for unique constraint across blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        phone varchar [unique]
      }

      records users(id, email) {
        1, null
        2, null  // Multiple NULLs allowed
      }

      records users(id, phone) {
        3, null
        4, null  // Multiple NULLs allowed
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should handle unique when column missing from some blocks', () => {
    const source = `
      Table products {
        id int [pk]
        sku varchar [unique]
        name varchar
        description text
      }

      records products(id, name) {
        1, 'Product A'  // sku missing, implicitly NULL
      }

      records products(id, sku) {
        2, 'SKU-001'
        3, 'SKU-002'
      }

      records products(id, description) {
        4, 'Description text'  // sku missing, implicitly NULL
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should validate multiple unique constraints on same table across blocks', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
        phone varchar [unique]
      }

      records users(id, email, username) {
        1, 'alice@example.com', 'alice'
      }

      records users(id, phone) {
        2, '555-0001'
      }

      records users(id, email) {
        3, 'bob@example.com'
      }

      records users(id, username, phone) {
        4, 'charlie', '555-0002'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect violations of different unique constraints', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar [unique]
      }

      records users(id, email) {
        1, 'alice@example.com'
      }

      records users(id, username) {
        2, 'bob'
      }

      records users(id, email, username) {
        3, 'alice@example.com', 'charlie'  // Duplicate email
        4, 'david@example.com', 'bob'       // Duplicate username
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(2);
    expect(warnings.some((e) => e.diagnostic.includes('email'))).toBe(true);
    expect(warnings.some((e) => e.diagnostic.includes('username'))).toBe(true);
  });

  test('should validate unique across nested and top-level records', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]
        username varchar

        records (id, email) {
          1, 'alice@example.com'
        }
      }

      records users(id, username) {
        2, 'bob'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect unique violation between nested and top-level', () => {
    const source = `
      Table users {
        id int [pk]
        email varchar [unique]

        records (id, email) {
          1, 'alice@example.com'
        }
      }

      records users(id, email) {
        2, 'alice@example.com'  // Duplicate
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toContain('Duplicate UNIQUE');
  });

  test('should handle complex scenario with multiple unique constraints', () => {
    const source = `
      Table employees {
        id int [pk]
        email varchar [unique]
        employee_code varchar [unique]
        ssn varchar [unique]
        name varchar
      }

      records employees(id, email, employee_code) {
        1, 'emp1@company.com', 'EMP001'
      }

      records employees(id, ssn) {
        2, '123-45-6789'
      }

      records employees(id, email, ssn) {
        3, 'emp3@company.com', '987-65-4321'
      }

      records employees(id, employee_code, name) {
        4, 'EMP004', 'John Doe'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect multiple unique violations in complex scenario', () => {
    const source = `
      Table products {
        id int [pk]
        sku varchar [unique]
        barcode varchar [unique]
        name varchar
      }

      records products(id, sku, barcode) {
        1, 'SKU-001', 'BAR-001'
      }

      records products(id, sku) {
        2, 'SKU-002'
      }

      records products(id, sku, name) {
        3, 'SKU-001', 'Product 3'  // Duplicate SKU
      }

      records products(id, barcode) {
        4, 'BAR-001'  // Duplicate barcode
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toContain('Duplicate UNIQUE');
    expect(warnings[1].diagnostic).toContain('Duplicate UNIQUE');
  });

  test('should validate unique with both PK and unique constraints', () => {
    const source = `
      Table users {
        id int [pk, unique]  // Both PK and unique
        email varchar [unique]
      }

      records users(id) {
        1
      }

      records users(id, email) {
        2, 'alice@example.com'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });
});
