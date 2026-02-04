import { analyze } from '@tests/utils';
import { describe, expect, test } from 'vitest';

describe('[example] validator - check with enum', () => {
  test('should allow simple enums in inline checks', () => {
    const source = 'Table users { id int [check: enum] }';
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });
  test('should allow schema-qualified enums in inline checks', () => {
    const source = 'Table users { id int [check: schema.enum] }';
    const errors = analyze(source).getErrors();
    expect(errors).toHaveLength(0);
  });
});
