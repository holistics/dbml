import {
  describe, expect, test,
} from 'vitest';
import {
  interpret,
} from '@tests/utils';

describe('[example] ref inactive setting', () => {
  test('should set inactive to true when inactive setting present', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [inactive]
    `;
    const db = interpret(source).getValue()!;

    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].inactive).toBe(true);
  });

  test('should not set inactive when setting absent', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id
    `;
    const db = interpret(source).getValue()!;

    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].inactive).toBeUndefined();
  });

  test('should not set inactive when other settings present', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [delete: cascade]
    `;
    const db = interpret(source).getValue()!;

    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].inactive).toBeUndefined();
  });
});
