import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/types/errors';
import { analyze, interpret } from '@tests/utils';

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

describe('[example] ref note setting', () => {
  test('should accept ref with a string note', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [note: 'author of the post']
    `;
    const errors = analyze(source).getErrors();

    expect(errors).toHaveLength(0);

    const db = interpret(source).getValue();
    expect(db?.refs[0].note?.value).toBe('author of the post');
    expect(db?.refs[0].metadata).toEqual({});
  });

  test('should accept a string note in a block-form ref', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref r {
        posts.user_id > users.id [note: 'author of the post']
      }
    `;
    const errors = analyze(source).getErrors();

    expect(errors).toHaveLength(0);
    expect(interpret(source).getValue()?.refs[0].note?.value).toBe('author of the post');
  });

  test('should reject a color literal as note', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [note: #fff]
    `;
    const errors = analyze(source).getErrors();

    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_REF_SETTING_VALUE);
    expect(errors[0].diagnostic).toBe("'note' must be a string literal");
  });

  test('should not crash when interpreting a non-string note', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [note: #fff]
    `;

    expect(() => interpret(source)).not.toThrow();
  });

  test('should reject duplicate note setting', () => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id > users.id [note: 'a', note: 'b']
    `;
    const errors = analyze(source).getErrors();

    expect(errors).toHaveLength(2);
    expect(errors[0].code).toBe(CompileErrorCode.DUPLICATE_REF_SETTING);
    expect(errors[0].diagnostic).toBe("'note' can only appear once");
  });
});
