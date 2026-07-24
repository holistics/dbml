import {
  describe, expect, test,
} from 'vitest';
import {
  analyze, interpret,
} from '@tests/utils';

describe('[example] nullable column with required operator', () => {
  test('all columns nullable should emit info', () => {
    const source = `
      Table users { id int [pk] }
      Table posts { user_id int }
      Ref: posts.user_id > users.id
    `;
    const infos = interpret(source).getInfos();
    expect(infos.some((i) => i.diagnostic.includes('nullable'))).toBe(true);
  });

  test('composite ref with all columns nullable should emit info', () => {
    const source = `
      Table a {
        id int [pk]
        code int [unique]
        Indexes { (id, code) [unique] }
      }
      Table b {
        a_id int
        a_code int
      }
      Ref: b.(a_id, a_code) > a.(id, code)
    `;
    const infos = interpret(source).getInfos();
    expect(infos.some((i) => i.diagnostic.includes('nullable'))).toBe(true);
  });

  test('composite ref with one NOT NULL column should NOT emit info', () => {
    const source = `
      Table a {
        id int [pk]
        code int [unique]
        Indexes { (id, code) [unique] }
      }
      Table b {
        a_id int [not null]
        a_code int
      }
      Ref: b.(a_id, a_code) > a.(id, code)
    `;
    const infos = interpret(source).getInfos();
    expect(infos.filter((i) => i.diagnostic.includes('nullable'))).toHaveLength(0);
  });

  test('single NOT NULL column should NOT emit info', () => {
    const source = `
      Table users { id int [pk] }
      Table posts { user_id int [not null] }
      Ref: posts.user_id > users.id
    `;
    const infos = interpret(source).getInfos();
    expect(infos.filter((i) => i.diagnostic.includes('nullable'))).toHaveLength(0);
  });
});

describe('[example] optional ref validation', () => {
  test.each([
    '-', '-?', '?-', '?-?',
    '>', '>?', '?>', '?>?',
    '<', '<?', '?<', '?<?',
    '<>', '<>?', '?<>', '?<>?',
  ])('should accept standalone ref with operator %s', (op) => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id ${op} users.id
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });

  test.each([
    '>', '>?', '?>', '?>?',
    '<', '<?', '?<', '?<?',
    '-', '-?', '?-', '?-?',
    '<>', '<>?', '?<>', '?<>?',
  ])('should accept inline ref with operator %s', (op) => {
    const source = `
      Table users { id int }
      Table posts {
        user_id int [ref: ${op} users.id]
      }
    `;
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });
});
