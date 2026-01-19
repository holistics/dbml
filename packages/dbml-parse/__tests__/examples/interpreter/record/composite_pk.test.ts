import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

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

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate Composite PK: (order_items.order_id, order_items.product_id) = (1, 100)');
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

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('NULL in Composite PK: (order_items.order_id, order_items.product_id) cannot be NULL');
  });

  test('should detect duplicate composite pk across multiple records blocks', () => {
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
    const warnings = result.getWarnings();

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate Composite PK: (order_items.order_id, order_items.product_id) = (1, 100)');
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
