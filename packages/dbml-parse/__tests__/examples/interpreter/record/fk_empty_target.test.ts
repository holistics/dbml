import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/errors';

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
    const errors = result.getErrors();

    // Should have FK violations since users table is empty but follows references it
    expect(errors.length).toBe(2); // Two FK violations: following_user_id and followed_user_id
    expect(errors.every(e => e.code === CompileErrorCode.INVALID_RECORDS_FIELD)).toBe(true);
    expect(errors.every(e => e.diagnostic.includes('does not exist in'))).toBe(true);
  });
});
