import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/index';

describe('[example - record] composite foreign key constraints', () => {
  test('should accept valid composite FK references', () => {
    const source = `
      Table merchants {
        id int
        country_code varchar

        indexes {
          (id, country_code) [pk]
        }
      }
      Table orders {
        id int [pk]
        merchant_id int
        country varchar
        amount decimal
      }
      Ref: orders.(merchant_id, country) > merchants.(id, country_code)

      records merchants(id, country_code) {
        1, "US"
        1, "UK"
        2, "US"
      }
      records orders(id, merchant_id, country, amount) {
        1, 1, "US", 100.00
        2, 1, "UK", 200.50
        3, 2, "US", 50.00
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(2);

    // Merchants table
    // columns = ['id', 'country_code']
    expect(db.records[0].tableName).toBe('merchants');
    expect(db.records[0].values.length).toBe(3);
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'US' });

    // Orders table
    // columns = ['id', 'merchant_id', 'country', 'amount']
    expect(db.records[1].tableName).toBe('orders');
    expect(db.records[1].values.length).toBe(3);
    expect(db.records[1].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][1]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][2]).toEqual({ type: 'string', value: 'US' });
    expect(db.records[1].values[0][3]).toEqual({ type: 'real', value: 100.00 });
  });

  test('should reject composite FK when partial key match fails', () => {
    const source = `
      Table merchants {
        id int
        country_code varchar

        indexes {
          (id, country_code) [pk]
        }
      }
      Table orders {
        id int [pk]
        merchant_id int
        country varchar
      }
      Ref: orders.(merchant_id, country) > merchants.(id, country_code)

      records merchants(id, country_code) {
        1, "US"
        2, "UK"
      }
      records orders(id, merchant_id, country) {
        1, 1, "US"
        2, 1, "UK"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('FK violation: (orders.merchant_id, orders.country) = (1, "UK") does not exist in (merchants.id, merchants.country_code)');
    expect(warnings[1].diagnostic).toBe('FK violation: (orders.merchant_id, orders.country) = (1, "UK") does not exist in (merchants.id, merchants.country_code)');
  });

  test('should allow NULL in composite FK columns', () => {
    const source = `
      Table merchants {
        id int
        country_code varchar

        indexes {
          (id, country_code) [pk]
        }
      }
      Table orders {
        id int [pk]
        merchant_id int
        country varchar
        status varchar
      }
      Ref: orders.(merchant_id, country) > merchants.(id, country_code)

      records merchants(id, country_code) {
        1, "US"
      }
      records orders(id, merchant_id, country, status) {
        1, 1, "US", "confirmed"
        2, null, "UK", "pending"
        3, 1, null, "processing"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[1].values.length).toBe(3);

    // Row 2: null FK column
    // columns = ['id', 'merchant_id', 'country', 'status']
    expect(db.records[1].values[1][1].value).toBe(null); // merchant_id
    expect(db.records[1].values[1][2]).toEqual({ type: 'string', value: 'UK' }); // country
    expect(db.records[1].values[1][3]).toEqual({ type: 'string', value: 'pending' }); // status

    // Row 3: null FK column
    expect(db.records[1].values[2][0]).toEqual({ type: 'integer', value: 3 }); // id
    expect(db.records[1].values[2][2].value).toBe(null); // country
    expect(db.records[1].values[2][3]).toEqual({ type: 'string', value: 'processing' }); // status
  });

  test('should validate many-to-many composite FK both directions', () => {
    const source = `
      Table products {
        id int
        region varchar

        indexes {
          (id, region) [pk]
        }
      }
      Table categories {
        id int
        region varchar

        indexes {
          (id, region) [pk]
        }
      }
      Ref: products.(id, region) <> categories.(id, region)

      records products(id, region) {
        1, "US"
        2, "US"
      }
      records categories(id, region) {
        1, "US"
        3, "EU"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(4);
    expect(warnings[0].diagnostic).toBe('FK violation: (products.id, products.region) = (2, "US") does not exist in (categories.id, categories.region)');
    expect(warnings[1].diagnostic).toBe('FK violation: (products.id, products.region) = (2, "US") does not exist in (categories.id, categories.region)');
    expect(warnings[2].diagnostic).toBe('FK violation: (categories.id, categories.region) = (3, "EU") does not exist in (products.id, products.region)');
    expect(warnings[3].diagnostic).toBe('FK violation: (categories.id, categories.region) = (3, "EU") does not exist in (products.id, products.region)');
  });

  test('should validate composite FK with schema-qualified tables', () => {
    const source = `
      Table auth.users {
        id int
        tenant_id int

        indexes {
          (id, tenant_id) [pk]
        }
      }
      Table public.posts {
        id int [pk]
        user_id int
        tenant_id int
        content text
      }
      Ref: public.posts.(user_id, tenant_id) > auth.users.(id, tenant_id)

      records auth.users(id, tenant_id) {
        1, 100
        2, 100
      }
      records public.posts(id, user_id, tenant_id, content) {
        1, 1, 100, "Hello"
        2, 999, 100, "Invalid user"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('FK violation: (public.posts.user_id, public.posts.tenant_id) = (999, 100) does not exist in (auth.users.id, auth.users.tenant_id)');
    expect(warnings[1].diagnostic).toBe('FK violation: (public.posts.user_id, public.posts.tenant_id) = (999, 100) does not exist in (auth.users.id, auth.users.tenant_id)');
  });
});

describe('[example - record] simple foreign key constraints', () => {
  test('should validate FK with various data types and values', () => {
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
      Table posts {
        id int [pk]
        user_id int
        title varchar
      }
      Table cities {
        id int [pk]
        country_code varchar(2)
        name varchar
      }
      Table transactions {
        id int [pk]
        account_id int
        amount decimal
      }
      Ref: posts.user_id > users.id
      Ref: cities.country_code > countries.code
      Ref: transactions.account_id > accounts.id

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
      records posts(id, user_id, title) {
        1, 1, "Alice Post"
        2, 1, "Another Post"
        3, 2, "Bob Post"
      }
      records cities(id, country_code, name) {
        1, "US", "New York"
        2, "UK", "London"
      }
      records transactions(id, account_id, amount) {
        1, 0, 100.00
        2, 1, 50.00
        3, 2, 25.00
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
    expect(db.records.length).toBe(6);

    // Verify users table
    expect(db.records[0].tableName).toBe('users');
    expect(db.records[0].values.length).toBe(2);
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Alice' });
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Verify posts table (find it by name since order might vary)
    const postsRecord = db.records.find((r) => r.tableName === 'posts');
    expect(postsRecord).toBeDefined();
    expect(postsRecord!.values.length).toBe(3);
    expect(postsRecord!.values[0][1]).toEqual({ type: 'integer', value: 1 }); // user_id

    // Verify cities table with string FK
    const citiesRecord = db.records.find((r) => r.tableName === 'cities');
    expect(citiesRecord).toBeDefined();
    expect(citiesRecord!.values[0][1]).toEqual({ type: 'string', value: 'US' }); // country_code
    expect(citiesRecord!.values[1][1]).toEqual({ type: 'string', value: 'UK' });

    // Verify transactions table with zero values
    const transactionsRecord = db.records.find((r) => r.tableName === 'transactions');
    expect(transactionsRecord).toBeDefined();
    expect(transactionsRecord!.values[0][1]).toEqual({ type: 'integer', value: 0 }); // account_id=0
    expect(transactionsRecord!.values[1][1]).toEqual({ type: 'integer', value: 1 }); // account_id=1
    expect(transactionsRecord!.values[2][1]).toEqual({ type: 'integer', value: 2 }); // account_id=2
  });

  test('should reject FK values that dont exist in referenced table', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int
        title varchar
      }
      Table cities {
        id int [pk]
        country_code varchar(2)
        name varchar
      }
      Ref: posts.user_id > users.id
      Ref: cities.country_code > countries.code

      records users(id, name) {
        1, "Alice"
      }
      records countries(code, name) {
        "US", "United States"
      }
      records posts(id, user_id, title) {
        1, 1, "Valid Post"
        2, 999, "Invalid FK"
      }
      records cities(id, country_code, name) {
        1, "US", "New York"
        2, "FR", "Paris"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('FK violation: posts.user_id = 999 does not exist in users.id');
    expect(warnings[1].diagnostic).toBe('FK violation: cities.country_code = "FR" does not exist in countries.code');
  });

  test('should allow NULL FK values (optional relationship)', () => {
    const source = `
      Table categories {
        id int [pk]
        name varchar
      }
      Table products {
        id int [pk]
        category_id int
        name varchar
      }
      Ref: products.category_id > categories.id

      records categories(id, name) {
        1, "Electronics"
      }
      records products(id, category_id, name) {
        1, 1, "Laptop"
        2, null, "Uncategorized Item"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[1].values.length).toBe(2);

    // Row 1: id=1, category_id=1, name="Laptop"
    expect(db.records[1].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][1]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][2]).toEqual({ type: 'string', value: 'Laptop' });

    // Row 2: id=2, category_id=null, name="Uncategorized Item"
    expect(db.records[1].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[1].values[1][1].value).toBe(null);
    expect(db.records[1].values[1][2]).toEqual({ type: 'string', value: 'Uncategorized Item' });
  });

  test('should validate one-to-one and one-to-many FK relationships', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table user_profiles {
        id int [pk]
        user_id int
        bio text
      }
      Table departments {
        id int [pk]
        name varchar
      }
      Table employees {
        id int [pk]
        dept_id int
        name varchar
      }
      Ref: user_profiles.user_id - users.id
      Ref: departments.id < employees.dept_id

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }
      records user_profiles(id, user_id, bio) {
        1, 1, "Alice's bio"
        2, 3, "Invalid user"
      }
      records departments(id, name) {
        1, "Engineering"
      }
      records employees(id, dept_id, name) {
        1, 1, "Alice"
        2, 999, "Bob with invalid dept"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    // One-to-one validates both directions:
    // 1. user_profiles.user_id=3 doesn't exist in users.id
    // 2. users.id=2 (Bob) doesn't have a matching user_profiles.user_id
    // One-to-many violation:
    // 3. employees.dept_id=999 doesn't exist in departments.id
    expect(warnings.length).toBe(3);
    expect(warnings[0].diagnostic).toBe('FK violation: user_profiles.user_id = 3 does not exist in users.id');
    expect(warnings[1].diagnostic).toBe('FK violation: users.id = 2 does not exist in user_profiles.user_id');
    expect(warnings[2].diagnostic).toBe('FK violation: employees.dept_id = 999 does not exist in departments.id');
  });

  test('should validate inline ref syntax and self-referencing FK', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int [ref: > users.id]
        title varchar
      }
      Table employees {
        id int [pk]
        manager_id int
        name varchar
      }
      Ref: employees.manager_id > employees.id

      records users(id, name) {
        1, "Alice"
      }
      records posts(id, user_id, title) {
        1, 1, "Valid Post"
        2, 999, "Invalid Post"
      }
      records employees(id, manager_id, name) {
        1, null, "CEO"
        2, 1, "Manager"
        3, 999, "Invalid Manager Reference"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('FK violation: posts.user_id = 999 does not exist in users.id');
    expect(warnings[1].diagnostic).toBe('FK violation: employees.manager_id = 999 does not exist in employees.id');
  });

  test('should detect FK violation when target table is empty', () => {
    const source = `
      Table follows {
        following_user_id integer
        followed_user_id integer
        created_at timestamp
      }

      Table users {
        id integer [primary key]
        username varchar
      }

      Ref: users.id < follows.following_user_id
      Ref: users.id < follows.followed_user_id

      Records follows(following_user_id, followed_user_id, created_at) {
        1, 2, '2026-01-01'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();

    // Should have FK violations since users table is empty but follows references it
    expect(warnings.length).toBe(2); // Two FK violations: following_user_id and followed_user_id
    expect(warnings.every((e) => e.code === CompileErrorCode.INVALID_RECORDS_FIELD)).toBe(true);
    expect(warnings.every((e) => e.diagnostic.includes('does not exist in'))).toBe(true);
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

describe('[example - record] FK in table partials', () => {
  test('should validate FK from injected table partial', () => {
    const source = `
      TablePartial fk_partial {
        user_id int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~fk_partial
      }

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }

      records posts(id, title, user_id) {
        1, "Post 1", 1
        2, "Post 2", 2
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should detect FK violation from injected table partial', () => {
    const source = `
      TablePartial fk_partial {
        user_id int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~fk_partial
      }

      records users(id, name) {
        1, "Alice"
      }

      records posts(id, title, user_id) {
        1, "Post 1", 1
        2, "Post 2", 999
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe('FK violation: posts.user_id = 999 does not exist in users.id');
  });

  test('should validate FK when partial injected into multiple tables', () => {
    const source = `
      TablePartial timestamps {
        created_by int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~timestamps
      }

      Table comments {
        id int [pk]
        content varchar
        ~timestamps
      }

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }

      records posts(id, title, created_by) {
        1, "Post 1", 1
        2, "Post 2", 2
      }

      records comments(id, content, created_by) {
        1, "Comment 1", 1
        2, "Comment 2", 999
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe('FK violation: comments.created_by = 999 does not exist in users.id');
  });

  test('should allow NULL FK values from injected table partial', () => {
    const source = `
      TablePartial optional_user {
        user_id int [ref: > users.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~optional_user
      }

      records users(id, name) {
        1, "Alice"
      }

      records posts(id, title, user_id) {
        1, "Post 1", 1
        2, "Anonymous Post", null
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should validate FK with multiple partials injected', () => {
    const source = `
      TablePartial user_ref {
        user_id int [ref: > users.id]
      }

      TablePartial category_ref {
        category_id int [ref: > categories.id]
      }

      Table users {
        id int [pk]
        name varchar
      }

      Table categories {
        id int [pk]
        name varchar
      }

      Table posts {
        id int [pk]
        title varchar
        ~user_ref
        ~category_ref
      }

      records users(id, name) {
        1, "Alice"
      }

      records categories(id, name) {
        1, "Tech"
      }

      records posts(id, title, user_id, category_id) {
        1, "Valid Post", 1, 1
        2, "Invalid Category", 1, 999
        3, "Invalid User", 999, 1
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(2);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    // Verify both errors are FK violations
    const errorMessages = warnings.map((e) => e.diagnostic);
    expect(errorMessages.every((msg) => msg.startsWith('FK violation'))).toBe(true);
  });

  test('should validate self-referencing FK from injected table partial', () => {
    const source = `
      TablePartial hierarchical {
        parent_id int [ref: > nodes.id]
      }

      Table nodes {
        id int [pk]
        name varchar
        ~hierarchical
      }

      records nodes(id, name, parent_id) {
        1, "Root", null
        2, "Child 1", 1
        3, "Invalid Child", 999
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe('FK violation: nodes.parent_id = 999 does not exist in nodes.id');
  });
});
