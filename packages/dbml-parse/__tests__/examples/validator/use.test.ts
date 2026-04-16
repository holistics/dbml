import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/types/errors';
import { validate } from '@tests/utils';

describe('[example] use declaration validation', () => {
  test('valid: selective, wildcard, reuse, reuse wildcard', () => {
    expect(validate(`use { table users } from './a'`).getErrors()).toHaveLength(0);
    expect(validate(`use * from './a'`).getErrors()).toHaveLength(0);
    expect(validate(`reuse { table users } from './a'`).getErrors()).toHaveLength(0);
    expect(validate(`reuse * from './a'`).getErrors()).toHaveLength(0);
  });

  test('valid: multiple specifiers, alias, schema-qualified, case-insensitive', () => {
    expect(validate(`use {\n  table users\n  enum status\n} from './a'`).getErrors()).toHaveLength(0);
    expect(validate(`use { table users as u } from './a'`).getErrors()).toHaveLength(0);
    expect(validate(`use { table auth.users } from './a'`).getErrors()).toHaveLength(0);
    expect(validate(`use {\n  Table x\n  ENUM y\n  TablePartial z\n} from './a'`).getErrors()).toHaveLength(0);
  });

  test('valid: ./ and ../ paths, empty specifier list, alongside elements', () => {
    expect(validate(`use { table x } from './schema'`).getErrors()).toHaveLength(0);
    expect(validate(`use { table x } from '../common/schema'`).getErrors()).toHaveLength(0);
    expect(validate(`use { } from './a'`).getErrors()).toHaveLength(0);
    expect(validate(`use { table x } from './a'\nTable t { id int }`).getErrors()).toHaveLength(0);
  });

  test('invalid: absolute import path', () => {
    const errors = validate(`use { table users } from '/absolute/path'`).getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_USE_SPECIFIER_NAME);
    expect(errors[0].diagnostic).toBe("Import path must be a relative path (starting with './' or '../')");
  });

  test('invalid: unknown specifier kind', () => {
    const errors = validate(`use { unknown_kind users } from './a'`).getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0].code).toBe(CompileErrorCode.INVALID_USE_SPECIFIER_KIND);
    expect(errors[0].diagnostic).toBe("'unknown_kind' is not a valid specifier type");
  });

  test('invalid: ref, project, indexes as specifier kind', () => {
    for (const kind of ['ref', 'project', 'indexes']) {
      const errors = validate(`use { ${kind} x } from './a'`).getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_USE_SPECIFIER_KIND);
      expect(errors[0].diagnostic).toBe(`'${kind}' is not a valid specifier type`);
    }
  });

  test('invalid: specifier without name - 2 errors', () => {
    const errors = validate(`use { table } from './a'`).getErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0].diagnostic).toBe('Expect an element name');
  });

  test('invalid: missing from clause - 2 errors', () => {
    const errors = validate(`use { table users }`).getErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0].diagnostic).toBe("Expect 'from' after specifier list");
    expect(errors[1].diagnostic).toBe('Unexpected EOF');
  });

  test('invalid: missing path after from - 2 errors', () => {
    const errors = validate(`use { table users } from`).getErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0].diagnostic).toBe('Expect a string literal path');
    expect(errors[1].diagnostic).toBe('Unexpected EOF');
  });

  test('invalid: missing specifiers or wildcard - 2 errors', () => {
    const errors = validate(`use from './a'`).getErrors();
    expect(errors).toHaveLength(2);
    expect(errors[0].diagnostic).toBe("Expect an opening brace '{'");
    expect(errors[1].diagnostic).toBe('Expect an identifier');
  });
});
