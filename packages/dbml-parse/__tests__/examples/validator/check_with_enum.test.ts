import { validate } from '@tests/utils/compiler';
import { describe, expect, test } from 'vitest';

describe('[example] validator - check with enum', () => {
  test('should allow simple enums in inline checks of tables', () => {
    const source = 'Table users { id int [check: enum] }';
    const errors = validate(source).getErrors();
    expect(errors).toHaveLength(0);
  });
  test('should allow schema-qualified enums in inline checks of tables', () => {
    const source = 'Table users { id int [check: schema.enum] }';
    const errors = validate(source).getErrors();
    expect(errors).toHaveLength(0);
  });
  test('should allow simple enums in inline checks of table partials', () => {
    const source = 'TablePartial users { id int [check: enum] }';
    const errors = validate(source).getErrors();
    expect(errors).toHaveLength(0);
  });
  test('should allow schema-qualified enums in inline checks of table partials', () => {
    const source = 'TablePartial users { id int [check: schema.enum] }';
    const errors = validate(source).getErrors();
    expect(errors).toHaveLength(0);
  });
});
