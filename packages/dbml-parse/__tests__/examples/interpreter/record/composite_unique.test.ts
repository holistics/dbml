import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

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

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate Composite UNIQUE: (user_profiles.user_id, user_profiles.profile_type) = (1, "work")');
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

    expect(warnings.length).toBe(1);
    expect(warnings[0].diagnostic).toBe('Duplicate Composite UNIQUE: (user_profiles.user_id, user_profiles.profile_type) = (1, "work")');
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
