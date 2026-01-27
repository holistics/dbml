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
    expect(db.records[0].values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'integer', value: 42 });
    expect(db.records[0].values[0][2]).toEqual({ type: 'integer', value: -100 });
    expect(db.records[0].values[0][3]).toEqual({ type: 'integer', value: 9999999999 });
    expect(db.records[0].values[1][0]).toEqual({ type: 'integer', value: 0 });
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
    expect(db.records[0].values[0][0]).toEqual({ type: 'real', value: 99.99 });
    expect(db.records[0].values[0][1]).toEqual({ type: 'real', value: 3.14159 });
    expect(db.records[0].values[0][2]).toEqual({ type: 'real', value: 0.001 });
    expect(db.records[0].values[1][0]).toEqual({ type: 'real', value: 50.5 });
    expect(db.records[0].values[1][1]).toEqual({ type: 'real', value: 0.5 });
    expect(db.records[0].values[1][2]).toEqual({ type: 'real', value: 100 });
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
    expect(db.records[0].values[0][0]).toEqual({ type: 'bool', value: true });
    expect(db.records[0].values[0][1]).toEqual({ type: 'bool', value: false });
    expect(db.records[0].values[1][0]).toEqual({ type: 'bool', value: false });
    expect(db.records[0].values[1][1]).toEqual({ type: 'bool', value: true });
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
    expect(db.records[0].values[0][0]).toEqual({ type: 'string', value: 'Alice' });
    expect(db.records[0].values[0][1]).toEqual({ type: 'string', value: 'A short description' });
    expect(db.records[0].values[0][2]).toEqual({ type: 'string', value: 'ABC123' });
    expect(db.records[0].values[1][0]).toEqual({ type: 'string', value: 'Bob' });
  });

  test('should interpret datetime values correctly', () => {
    const source = `
      Table events {
        created_at timestamp
        event_date date
        event_time time
      }
      records events(created_at, event_date, event_time) {
        "2024-01-15T10:30:00", "2024-01-15", "10:30:00"
        "2024-12-31T23:59:59", "2024-12-31", "23:59:59"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Note: timestamp->datetime, date->date, time->time
    expect(db.records[0].values[0][0].type).toBe('datetime');
    expect(db.records[0].values[0][0].value).toBe('2024-01-15T10:30:00.000+07:00');
    expect(db.records[0].values[0][1].type).toBe('date');
    expect(db.records[0].values[0][1].value).toBe('2024-01-15');
    expect(db.records[0].values[0][2].type).toBe('time');
    expect(db.records[0].values[0][2].value).toBe('10:30:00.000+07:00');
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
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('products');
    expect(record.columns).toEqual(['id', 'name']);
    expect(record.values.length).toBe(2);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 'Laptop')
    expect(record.values[0].length).toBe(2);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'Laptop' });

    // Second row: (2, null) - from (id, price, description), maps to ['id', 'name']
    expect(record.values[1].length).toBe(2);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'expression', value: null });
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
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('metrics');
    expect(record.columns).toEqual(['id', 'name', 'metric_value']);
    expect(record.values.length).toBe(3);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 'CPU Usage', 85.5)
    expect(record.values[0].length).toBe(3);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'CPU Usage' });
    expect(record.values[0][2]).toEqual({ type: 'real', value: 85.5 });

    // Second row: (2, null, null) - from (id, timestamp, active), maps to ['id', 'name', 'metric_value']
    expect(record.values[1].length).toBe(3);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'expression', value: null });
    expect(record.values[1][2]).toEqual({ type: 'expression', value: null });

    // Third row: (3, 'Memory Usage', 60.2) - maps to ['id', 'name', 'metric_value']
    expect(record.values[2].length).toBe(3);
    expect(record.values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(record.values[2][1]).toEqual({ type: 'string', value: 'Memory Usage' });
    expect(record.values[2][2]).toEqual({ type: 'real', value: 60.2 });
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
    // Verify complete records array
    expect(db.records.length).toBe(1);

    // Verify ALL properties of the TableRecord
    const record = db.records[0];
    expect(record.schemaName).toBe(undefined);
    expect(record.tableName).toBe('events');
    expect(record.columns).toEqual(['id', 'type', 'user_id']);
    expect(record.values.length).toBe(4);

    // Verify ALL rows and ALL columns in each row
    // First row: (1, 'login', 100)
    expect(record.values[0].length).toBe(3);
    expect(record.values[0][0]).toEqual({ type: 'integer', value: 1 });
    expect(record.values[0][1]).toEqual({ type: 'string', value: 'login' });
    expect(record.values[0][2]).toEqual({ type: 'integer', value: 100 });

    // Second row: (2, 'logout', 100)
    expect(record.values[1].length).toBe(3);
    expect(record.values[1][0]).toEqual({ type: 'integer', value: 2 });
    expect(record.values[1][1]).toEqual({ type: 'string', value: 'logout' });
    expect(record.values[1][2]).toEqual({ type: 'integer', value: 100 });

    // Third row: (3, 'purchase', null) - from (id, type, data), maps to ['id', 'type', 'user_id']
    expect(record.values[2].length).toBe(3);
    expect(record.values[2][0]).toEqual({ type: 'integer', value: 3 });
    expect(record.values[2][1]).toEqual({ type: 'string', value: 'purchase' });
    expect(record.values[2][2]).toEqual({ type: 'expression', value: null });

    // Fourth row: (4, null, null) - from (id, created_at), maps to ['id', 'type', 'user_id']
    expect(record.values[3].length).toBe(3);
    expect(record.values[3][0]).toEqual({ type: 'integer', value: 4 });
    expect(record.values[3][1]).toEqual({ type: 'expression', value: null });
    expect(record.values[3][2]).toEqual({ type: 'expression', value: null });
  });
});
