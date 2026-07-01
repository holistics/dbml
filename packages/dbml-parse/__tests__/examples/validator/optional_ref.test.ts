import {
  describe, expect, test,
} from 'vitest';
import {
  analyze,
} from '@tests/utils';

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
