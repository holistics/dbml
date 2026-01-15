import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example - record] data type interpretation', () => {
  test('should interpret integer values correctly', () => {
    const source = `
      Table data {
        id int
        count integer
        small smallint
        big bigint
      }
      records data(id, count, small, big) {
        1, 42, -100, 9999999999
        0, 0, 0, 0
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0].id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].count).toEqual({ type: 'integer', value: 42 });
    expect(db.records[0].values[0].small).toEqual({ type: 'integer', value: -100 });
    expect(db.records[0].values[0].big).toEqual({ type: 'integer', value: 9999999999 });
    expect(db.records[0].values[1].id).toEqual({ type: 'integer', value: 0 });
  });

  test('should interpret float and decimal values correctly', () => {
    const source = `
      Table data {
        price decimal(10,2)
        rate float
        amount numeric
      }
      records data(price, rate, amount) {
        99.99, 3.14159, 0.001
        50.5, 0.5, 100
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Note: float/numeric/decimal types are normalized to 'real'
    expect(db.records[0].values[0].price).toEqual({ type: 'real', value: 99.99 });
    expect(db.records[0].values[0].rate).toEqual({ type: 'real', value: 3.14159 });
    expect(db.records[0].values[0].amount).toEqual({ type: 'real', value: 0.001 });
    expect(db.records[0].values[1].price).toEqual({ type: 'real', value: 50.5 });
    expect(db.records[0].values[1].rate).toEqual({ type: 'real', value: 0.5 });
    expect(db.records[0].values[1].amount).toEqual({ type: 'real', value: 100 });
  });

  test('should interpret boolean values correctly', () => {
    const source = `
      Table data {
        active boolean
        verified bool
      }
      records data(active, verified) {
        true, false
        false, true
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Note: boolean types are normalized to 'bool'
    expect(db.records[0].values[0].active).toEqual({ type: 'bool', value: true });
    expect(db.records[0].values[0].verified).toEqual({ type: 'bool', value: false });
    expect(db.records[0].values[1].active).toEqual({ type: 'bool', value: false });
    expect(db.records[0].values[1].verified).toEqual({ type: 'bool', value: true });
  });

  test('should interpret string values correctly', () => {
    const source = `
      Table data {
        name varchar(255)
        description text
        code char(10)
      }
      records data(name, description, code) {
        "Alice", 'A short description', "ABC123"
        "Bob", "Another description", ""
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values[0].name).toEqual({ type: 'string', value: 'Alice' });
    expect(db.records[0].values[0].description).toEqual({ type: 'string', value: 'A short description' });
    expect(db.records[0].values[0].code).toEqual({ type: 'string', value: 'ABC123' });
    expect(db.records[0].values[1].name).toEqual({ type: 'string', value: 'Bob' });
  });

  test('should interpret datetime values correctly', () => {
    const source = `
      Table events {
        created_at timestamp
        event_date date
        event_time time
      }
      records events(created_at, event_date, event_time) {
        "2024-01-15T10:30:00Z", "2024-01-15", "10:30:00"
        "2024-12-31T23:59:59", "2024-12-31", "23:59:59"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Note: timestamp->datetime, date->date, time->time
    expect(db.records[0].values[0].created_at.type).toBe('datetime');
    expect(db.records[0].values[0].created_at.value).toBe('2024-01-15T10:30:00Z');
    expect(db.records[0].values[0].event_date.type).toBe('date');
    expect(db.records[0].values[0].event_date.value).toBe('2024-01-15');
    expect(db.records[0].values[0].event_time.type).toBe('time');
    expect(db.records[0].values[0].event_time.value).toBe('10:30:00');
  });

  test('should handle nested records with partial columns', () => {
    const source = `
      Table products {
        id int [pk]
        name varchar
        price decimal
        description text

        records (id, name) {
          1, 'Laptop'
        }

        records (id, price, description) {
          2, 999.99, 'High-end gaming laptop'
        }
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].tableName).toBe('products');
    expect(db.records[0].values).toHaveLength(2);

    // First row has id and name, but no price or description
    expect(db.records[0].values[0].id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].name).toEqual({ type: 'string', value: 'Laptop' });
    expect(db.records[0].values[0].price).toBeUndefined();
    expect(db.records[0].values[0].description).toBeUndefined();

    // Second row has id, price, and description, but no name
    expect(db.records[0].values[1].id).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1].name).toBeUndefined();
    expect(db.records[0].values[1].price).toEqual({ type: 'real', value: 999.99 });
    expect(db.records[0].values[1].description).toEqual({ type: 'string', value: 'High-end gaming laptop' });
  });

  test('should handle nested and top-level records with different data types', () => {
    const source = `
      Table metrics {
        id int [pk]
        name varchar
        metric_value decimal
        timestamp timestamp
        active boolean

        records (id, name, metric_value) {
          1, 'CPU Usage', 85.5
        }
      }

      records metrics(id, timestamp, active) {
        2, '2024-01-15T10:00:00Z', true
      }

      records metrics(id, name, metric_value, timestamp, active) {
        3, 'Memory Usage', 60.2, '2024-01-15T11:00:00Z', false
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].tableName).toBe('metrics');
    expect(db.records[0].values).toHaveLength(3);

    // All unique columns should be in the merged columns list
    expect(db.records[0].columns).toContain('id');
    expect(db.records[0].columns).toContain('name');
    expect(db.records[0].columns).toContain('metric_value');
    expect(db.records[0].columns).toContain('timestamp');
    expect(db.records[0].columns).toContain('active');

    // First row: id, name, metric_value (nested)
    expect(db.records[0].values[0].id).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0].name).toEqual({ type: 'string', value: 'CPU Usage' });
    expect(db.records[0].values[0].metric_value).toEqual({ type: 'real', value: 85.5 });
    expect(db.records[0].values[0].timestamp).toBeUndefined();
    expect(db.records[0].values[0].active).toBeUndefined();

    // Second row: id, timestamp, active (top-level)
    expect(db.records[0].values[1].id).toEqual({ type: 'integer', value: 2 });
    expect(db.records[0].values[1].name).toBeUndefined();
    expect(db.records[0].values[1].metric_value).toBeUndefined();
    expect(db.records[0].values[1].timestamp.type).toBe('datetime');
    expect(db.records[0].values[1].active).toEqual({ type: 'bool', value: true });

    // Third row: all columns (top-level with explicit columns)
    expect(db.records[0].values[2].id).toEqual({ type: 'integer', value: 3 });
    expect(db.records[0].values[2].name).toEqual({ type: 'string', value: 'Memory Usage' });
    expect(db.records[0].values[2].metric_value).toEqual({ type: 'real', value: 60.2 });
    expect(db.records[0].values[2].timestamp.type).toBe('datetime');
    expect(db.records[0].values[2].active).toEqual({ type: 'bool', value: false });
  });

  test('should handle multiple nested records blocks for same table', () => {
    const source = `
      Table events {
        id int [pk]
        type varchar
        user_id int
        data text
        created_at timestamp

        records (id, type, user_id) {
          1, 'login', 100
          2, 'logout', 100
        }

        records (id, type, data) {
          3, 'purchase', 'item_id: 42'
        }

        records (id, created_at) {
          4, '2024-01-15T10:00:00Z'
        }
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    expect(db.records[0].values).toHaveLength(4);

    // Verify different column combinations are merged correctly
    expect(db.records[0].values[0].id).toBeDefined();
    expect(db.records[0].values[0].type).toBeDefined();
    expect(db.records[0].values[0].user_id).toBeDefined();
    expect(db.records[0].values[0].data).toBeUndefined();

    expect(db.records[0].values[2].data).toBeDefined();
    expect(db.records[0].values[2].user_id).toBeUndefined();

    expect(db.records[0].values[3].created_at).toBeDefined();
    expect(db.records[0].values[3].type).toBeUndefined();
  });
});
