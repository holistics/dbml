import {
  describe, expect, test,
} from 'vitest';
import {
  CompileErrorCode,
} from '@/core/types/errors';
import {
  analyze,
} from '@tests/utils';

describe('[example] ref inactive setting', () => {
  test('should accept ref with inactive setting', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [inactive]
    `;
    const errors = analyze(source).getErrors();

    expect(errors).toHaveLength(0);
  });

  test('should reject duplicate inactive setting', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [inactive, inactive]
    `;
    const errors = analyze(source).getErrors();

    expect(errors).toHaveLength(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_REF_SETTING);
    expect(errors[0].diagnostic).toBe("'inactive' can only appear once");
  });

  test('should reject inactive setting with a value', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [inactive: true]
    `;
    const errors = analyze(source).getErrors();

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_REF_SETTING_VALUE);
    expect(errors[0].diagnostic).toBe("'inactive' cannot have a value");
  });
});
