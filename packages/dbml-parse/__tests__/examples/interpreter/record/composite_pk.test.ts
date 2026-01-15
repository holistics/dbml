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
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].tableName).toBe('order_items');
    expect(db.records[0].columns).toEqual(['order_id', 'product_id', 'quantity']);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: order_id=1, product_id=100, quantity=2
    expect(db.records[0].values[0].order_id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].product_id).toEqual({ type: 'integer', value: 100 });
    expect(db.records[0].values[0].quantity).toEqual({ type: 'integer', value: 2 });

    // Row 2: order_id=1, product_id=101, quantity=1
    expect(db.records[0].values[1].order_id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1].product_id).toEqual({ type: 'integer', value: 101 });
    expect(db.records[0].values[1].quantity).toEqual({ type: 'integer', value: 1 });

    // Row 3: order_id=2, product_id=100, quantity=3
    expect(db.records[0].values[2].order_id).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[2].product_id).toEqual({ type: 'integer', value: 100 });
    expect(db.records[0].values[2].quantity).toEqual({ type: 'integer', value: 3 });
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
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe('Duplicate primary key (order_id, product_id)');
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
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe('NULL value not allowed in composite primary key (order_id, product_id)');
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
    const errors = result.getErrors();

    expect(errors.length).toBe(1);
    expect(errors[0].diagnostic).toBe('Duplicate primary key (order_id, product_id)');
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
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records.length).toBe(1);
    expect(db.records[0].values.length).toBe(3);

    // Row 1: user_id=1, role_id=1, assigned_at="2024-01-01"
    expect(db.records[0].values[0].user_id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].role_id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].assigned_at.type).toBe('datetime');
    expect(db.records[0].values[0].assigned_at.value).toBe('2024-01-01');

    // Row 2: user_id=1, role_id=2, assigned_at="2024-01-02"
    expect(db.records[0].values[1].user_id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[1].role_id).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1].assigned_at.type).toBe('datetime');
    expect(db.records[0].values[1].assigned_at.value).toBe('2024-01-02');

    // Row 3: user_id=2, role_id=1, assigned_at="2024-01-03"
    expect(db.records[0].values[2].user_id).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[2].role_id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[2].assigned_at.type).toBe('datetime');
    expect(db.records[0].values[2].assigned_at.value).toBe('2024-01-03');
  });
});
