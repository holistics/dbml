import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

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
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(2);

    // Merchants table
    expect(db.records[0].tableName).toBe('merchants');
    expect(db.records[0].values.length).toBe(3);
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'US' });

    // Orders table
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
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Foreign key violation: value for column (merchant_id, country) does not exist in referenced table 'merchants'");
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
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[1].values.length).toBe(3);

    // Row 2: null FK column
    expect(db.records[1].values[1][1].value).toBe(null);
    expect(db.records[1].values[1][2]).toEqual({ type: 'string', value: 'UK' });
    expect(db.records[1].values[1][3]).toEqual({ type: 'string', value: 'pending' });

    // Row 3: null FK column
    expect(db.records[1].values[2][1]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[1].values[2][2].value).toBe(null);
    expect(db.records[1].values[2][3]).toEqual({ type: 'string', value: 'processing' });
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
    const errors = result.getErrors();

    expect(errors.length).toBe(2);
    expect(errors[0].diagnostic).toBe("Foreign key violation: value for column (id, region) does not exist in referenced table 'categories'");
    expect(errors[1].diagnostic).toBe("Foreign key violation: value for column (id, region) does not exist in referenced table 'products'");
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
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe("Foreign key violation: value for column (user_id, tenant_id) does not exist in referenced table 'users'");
  });
});
