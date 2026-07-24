import {
  describe, expect, test,
} from 'vitest';
import {
  parse,
} from '@tests/utils';

describe('[example] optional ref parsing', () => {
  test.each([
    '-', '-?', '?-', '?-?',
    '>', '>?', '?>', '?>?',
    '<', '<?', '?<', '?<?',
    '<>', '<>?', '?<>', '?<>?',
  ])('should parse standalone ref with operator %s without errors', (op) => {
    const source = `
      Table users { id int }
      Table posts { user_id int }
      Ref: posts.user_id ${op} users.id
    `;
    const result = parse(source);
    expect(result.getErrors()).toHaveLength(0);
  });

  test.each([
    '>', '>?', '?>', '?>?',
    '<', '<?', '?<', '?<?',
    '-', '-?', '?-', '?-?',
    '<>', '<>?', '?<>', '?<>?',
  ])('should parse inline ref with operator %s without errors', (op) => {
    const source = `
      Table users { id int }
      Table posts {
        user_id int [ref: ${op} users.id]
      }
    `;
    const result = parse(source);
    expect(result.getErrors()).toHaveLength(0);
  });
});
