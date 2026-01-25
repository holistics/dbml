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
  test('should accept valid many-to-one FK references', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int
        title varchar
      }
      Ref: posts.user_id > users.id

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }
      records posts(id, user_id, title) {
        1, 1, "Alice's Post"
        2, 1, "Another Post"
        3, 2, "Bob's Post"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(2);

    // Users table
    expect(db.records[0].tableName).toBe('users');
    expect(db.records[0].values.length).toBe(2);
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'Alice' });
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'string', value: 'Bob' });

    // Posts table
    expect(db.records[1].tableName).toBe('posts');
    expect(db.records[1].values.length).toBe(3);
    expect(db.records[1].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][1]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[0][2]).toEqual({ type: 'string', value: "Alice's Post" });
  });

  test('should reject FK values that dont exist in referenced table', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int
        title varchar
      }
      Ref: posts.user_id > users.id

      records users(id, name) {
        1, "Alice"
      }
      records posts(id, user_id, title) {
        1, 1, "Valid Post"
        2, 999, "Invalid FK"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('FK violation: posts.user_id = 999 does not exist in users.id');
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

  test('should validate one-to-one FK both directions', () => {
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
      Ref: user_profiles.user_id - users.id

      records users(id, name) {
        1, "Alice"
        2, "Bob"
      }
      records user_profiles(id, user_id, bio) {
        1, 1, "Alice's bio"
        2, 3, "Invalid user"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    // One-to-one validates both directions:
    // 1. user_profiles.user_id=3 doesn't exist in users.id
    // 2. users.id=2 (Bob) doesn't have a matching user_profiles.user_id
    expect(warnings.length).toBe(2);
    expect(warnings[0].diagnostic).toBe('FK violation: user_profiles.user_id = 3 does not exist in users.id');
    expect(warnings[1].diagnostic).toBe('FK violation: users.id = 2 does not exist in user_profiles.user_id');
  });

  test('should validate one-to-many FK from parent side', () => {
    const source = `
      Table departments {
        id int [pk]
        name varchar
      }
      Table employees {
        id int [pk]
        dept_id int
        name varchar
      }
      Ref: departments.id < employees.dept_id

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

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('FK violation: employees.dept_id = 999 does not exist in departments.id');
  });

  test('should accept valid string FK values', () => {
    const source = `
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      Table cities {
        id int [pk]
        country_code varchar(2)
        name varchar
      }
      Ref: cities.country_code > countries.code

      records countries(code, name) {
        "US", "United States"
        "UK", "United Kingdom"
      }
      records cities(id, country_code, name) {
        1, "US", "New York"
        2, "UK", "London"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[1].values[0][1]).toEqual({ type: 'string', value: 'US' });
    expect(db.records[1].values[1][1]).toEqual({ type: 'string', value: 'UK' });
  });

  test('should reject invalid string FK values', () => {
    const source = `
      Table countries {
        code varchar(2) [pk]
        name varchar
      }
      Table cities {
        id int [pk]
        country_code varchar(2)
        name varchar
      }
      Ref: cities.country_code > countries.code

      records countries(code, name) {
        "US", "United States"
      }
      records cities(id, country_code, name) {
        1, "US", "New York"
        2, "FR", "Paris"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('FK violation: cities.country_code = "FR" does not exist in countries.code');
  });

  test('should validate FK with zero values', () => {
    const source = `
      Table items {
        id int [pk]
        name varchar
      }
      Table orders {
        id int [pk]
        item_id int
      }
      Ref: orders.item_id > items.id

      records items(id, name) {
        0, "Default Item"
        1, "Item One"
      }
      records orders(id, item_id) {
        1, 0
        2, 1
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should validate FK with negative values', () => {
    const source = `
      Table accounts {
        id int [pk]
        name varchar
      }
      Table transactions {
        id int [pk]
        account_id int
        amount decimal
      }
      Ref: transactions.account_id > accounts.id

      records accounts(id, name) {
        -1, "System Account"
        1, "User Account"
      }
      records transactions(id, account_id, amount) {
        1, -1, 100.00
        2, 1, 50.00
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should validate FK across multiple records blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }
      Table posts {
        id int [pk]
        user_id int
        title varchar
      }
      Ref: posts.user_id > users.id

      records users(id, name) {
        1, "Alice"
      }
      records users(id, name) {
        2, "Bob"
      }
      records posts(id, user_id, title) {
        1, 1, "Alice's Post"
      }
      records posts(id, user_id, title) {
        2, 2, "Bob's Post"
        3, 3, "Invalid Post"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('FK violation: posts.user_id = 3 does not exist in users.id');
  });

  test('should accept inline ref syntax for FK', () => {
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

      records users(id, name) {
        1, "Alice"
      }
      records posts(id, user_id, title) {
        1, 1, "Valid Post"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should reject invalid inline ref FK value', () => {
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

      records users(id, name) {
        1, "Alice"
      }
      records posts(id, user_id, title) {
        1, 1, "Valid Post"
        2, 999, "Invalid Post"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('FK violation: posts.user_id = 999 does not exist in users.id');
  });

  test('should accept self-referencing FK', () => {
    const source = `
      Table employees {
        id int [pk]
        manager_id int
        name varchar
      }
      Ref: employees.manager_id > employees.id

      records employees(id, manager_id, name) {
        1, null, "CEO"
        2, 1, "Manager"
        3, 2, "Employee"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should reject invalid self-referencing FK', () => {
    const source = `
      Table employees {
        id int [pk]
        manager_id int
        name varchar
      }
      Ref: employees.manager_id > employees.id

      records employees(id, manager_id, name) {
        1, null, "CEO"
        2, 999, "Invalid Manager Reference"
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('FK violation: employees.manager_id = 999 does not exist in employees.id');
  });
});

describe('FK with empty target table', () => {
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
        2, "Comment 2", 2
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should detect FK violation in one table when partial injected into multiple tables', () => {
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
      }

      records posts(id, title, created_by) {
        1, "Post 1", 1
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
        1, "Post 1", 1, 1
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should detect FK violation with multiple partials injected', () => {
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
        3, "Child 2", 1
        4, "Grandchild", 2
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(0);
  });

  test('should detect self-referencing FK violation from injected table partial', () => {
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
        2, "Invalid Child", 999
      }
    `;
    const result = interpret(source);
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toBe('FK violation: nodes.parent_id = 999 does not exist in nodes.id');
  });
});

describe('[example - record] FK validation across multiple records blocks', () => {
  test('should validate FK across records blocks with different columns', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }

      Table orders {
        id int [pk]
        user_id int [ref: > users.id]
        total decimal
      }

      records users(id, name) {
        1, 'Alice'
      }

      records users(id) {
        2
      }

      records orders(id, user_id) {
        100, 1  // Valid: user 1 exists
      }

      records orders(id, user_id, total) {
        101, 2, 250.00  // Valid: user 2 exists
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect FK violation when referenced value not in any records block', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
        email varchar
      }

      Table orders {
        id int [pk]
        user_id int [ref: > users.id]
      }

      records users(id, name) {
        1, 'Alice'
      }

      records users(id, email) {
        2, 'bob@example.com'
      }

      records orders(id, user_id) {
        100, 3  // Invalid: user 3 doesn't exist in any block
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(1);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('FK violation');
  });

  test('should validate composite FK across multiple records blocks', () => {
    const source = `
      Table users {
        tenant_id int
        user_id int
        name varchar
        indexes {
          (tenant_id, user_id) [pk]
        }
      }

      Table posts {
        id int [pk]
        tenant_id int
        author_id int
      }

      Ref: posts.(tenant_id, author_id) > users.(tenant_id, user_id)

      records users(tenant_id, user_id) {
        1, 100
      }

      records users(tenant_id, user_id, name) {
        1, 101, 'Bob'
        2, 200, 'Charlie'
      }

      records posts(id, tenant_id, author_id) {
        1, 1, 100  // Valid: (1, 100) exists
        2, 1, 101  // Valid: (1, 101) exists
        3, 2, 200  // Valid: (2, 200) exists
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect composite FK violation across blocks', () => {
    const source = `
      Table users {
        tenant_id int
        user_id int
        email varchar
        indexes {
          (tenant_id, user_id) [pk]
        }
      }

      Table posts {
        id int [pk]
        tenant_id int
        author_id int
      }

      Ref: posts.(tenant_id, author_id) > users.(tenant_id, user_id)

      records users(tenant_id, user_id) {
        1, 100
      }

      records users(tenant_id, user_id, email) {
        2, 200, 'user@example.com'
      }

      records posts(id, tenant_id, author_id) {
        1, 1, 101  // Invalid: (1, 101) doesn't exist
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(2);
    expect(warnings[0].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[0].diagnostic).toContain('FK violation');
    expect(warnings[1].code).toBe(CompileErrorCode.INVALID_RECORDS_FIELD);
    expect(warnings[1].diagnostic).toContain('FK violation');
  });

  test('should handle FK when referenced column appears in some but not all blocks', () => {
    const source = `
      Table categories {
        id int [pk]
        name varchar
        description text
      }

      Table products {
        id int [pk]
        category_id int [ref: > categories.id]
        name varchar
      }

      // Block 1: has id but not category_id
      records categories(id, name) {
        1, 'Electronics'
      }

      // Block 2: has different columns
      records categories(id, description) {
        2, 'Category 2 description'
      }

      // Block 3: has id again
      records categories(id, name) {
        3, 'Home'
      }

      records products(id, category_id, name) {
        100, 1, 'Laptop'
        101, 2, 'Mouse'
        102, 3, 'Chair'
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should validate FK with NULL values across blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }

      Table orders {
        id int [pk]
        user_id int [ref: > users.id]
        notes varchar
      }

      records users(id, name) {
        1, 'Alice'
      }

      records orders(id, user_id) {
        100, 1       // Valid
        101, null    // Valid: NULL FK allowed
      }

      records orders(id, notes) {
        102, 'No user'  // Valid: user_id implicitly NULL
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should validate bidirectional FK (1-1) across multiple blocks', () => {
    const source = `
      Table users {
        id int [pk]
        name varchar
      }

      Table profiles {
        id int [pk]
        user_id int [unique]
      }

      Ref: users.id <> profiles.user_id

      records users(id) {
        1
      }

      records users(id, name) {
        2, 'Bob'
      }

      records profiles(id, user_id) {
        10, 1
        11, 2
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });

  test('should detect bidirectional FK violation', () => {
    const source = `
      Table users {
        id int [pk]
      }

      Table profiles {
        id int [pk]
        user_id int [unique]
      }

      Ref: users.id <> profiles.user_id

      records users(id) {
        1
      }

      records profiles(id, user_id) {
        10, 1
        11, 3  // Invalid: user 3 doesn't exist
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBeGreaterThan(0);
    expect(warnings.some((e) => e.diagnostic.includes('FK violation'))).toBe(true);
  });

  test('should validate FK across nested and top-level records', () => {
    const source = `
      Table categories {
        id int [pk]
        name varchar

        records (id) {
          1
        }
      }

      records categories(id, name) {
        2, 'Electronics'
      }

      Table products {
        id int [pk]
        category_id int [ref: > categories.id]

        records (id, category_id) {
          100, 1  // References nested record
        }
      }

      records products(id, category_id) {
        101, 2  // References top-level record
      }
    `;

    const result = interpret(source);
    const warnings = result.getWarnings();
    expect(warnings.length).toBe(0);
  });
});
