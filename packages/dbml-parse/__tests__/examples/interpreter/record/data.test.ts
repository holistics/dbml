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
        "2024-01-15 10:30:00", "2024-01-15", "10:30:00"
        "2024-12-31 23:59:59", "2024-12-31", "23:59:59"
      }
    `;
    const result = interpret(source);
    const errors = result.getErrors();

    expect(errors.length).toBe(0);

    const db = result.getValue()!;
    // Note: timestamp->datetime, date->date, time->time
    expect(db.records[0].values[0][0].type).toBe('datetime');
    expect(db.records[0].values[0][0].value).toBe('2024-01-15T10:30:00');
    expect(db.records[0].values[0][1].type).toBe('date');
    expect(db.records[0].values[0][1].value).toBe('2024-01-15');
    expect(db.records[0].values[0][2].type).toBe('time');
    expect(db.records[0].values[0][2].value).toBe('10:30:00');
  });
});
