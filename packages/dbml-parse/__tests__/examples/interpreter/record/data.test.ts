import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/index';
import { interpret } from '@tests/utils';
import { DateTime } from 'luxon';

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
        "2024-01-15T10:30:00+07:00", "2024-01-15", "10:30:00+07:00"
        "2024-12-31T23:59:59+07:00", "2024-12-31", "23:59:59"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Note: timestamp->datetime, date->date, time->time
    expect(db.records[0].values[0][0].type).toBe('datetime');
    expect(db.records[0].values[0][0].value).toBe(DateTime.fromISO('2024-01-15T10:30:00.000+07:00').toISO());
    expect(db.records[0].values[0][1].type).toBe('date');
    expect(db.records[0].values[0][1].value).toBe('2024-01-15');
    expect(db.records[0].values[0][2].type).toBe('time');
    expect(db.records[0].values[0][2].value).toBe(DateTime.fromISO('10:30:00.000+07:00').toISOTime());
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for nested records with partial columns', () => {
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

    // Verify exact error count and ALL error properties
    expect(errors.length).toBe(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'products'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'products'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for nested and top-level records with different data types', () => {
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

    // Verify exact error count and ALL error properties (3 blocks = 4 errors)
    expect(errors.length).toBe(4);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'metrics'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'metrics'");
    expect(errors[2].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[2].diagnostic).toBe("Duplicate Records for the same Table 'metrics'");
    expect(errors[3].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[3].diagnostic).toBe("Duplicate Records for the same Table 'metrics'");
  });

  // NOTE: Multiple records blocks for the same table are currently disallowed.
  // We're weighing ideas if records should be merged in the future.
  test('should report error for multiple nested records blocks for same table', () => {
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

    // Verify exact error count and ALL error properties (3 blocks = 4 errors)
    expect(errors.length).toBe(4);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[0].diagnostic).toBe("Duplicate Records for the same Table 'events'");
    expect(errors[1].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[1].diagnostic).toBe("Duplicate Records for the same Table 'events'");
    expect(errors[2].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[2].diagnostic).toBe("Duplicate Records for the same Table 'events'");
    expect(errors[3].code).toBe(CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(errors[3].diagnostic).toBe("Duplicate Records for the same Table 'events'");
  });
});
