import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/errors';
import { analyze } from '@tests/utils';

describe('[example] validator - use statement', () => {
  describe('valid use statements', () => {
    test('should accept simple identifier name', () => {
      const source = "use { table users } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept dot-delimited name (schema.table)', () => {
      const source = "use { table public.users } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept multi-level dot-delimited name', () => {
      const source = "use { table a.b.c } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept all allowed element kinds', () => {
      const kinds = ['table', 'enum', 'tablegroup', 'tablepartial'];
      for (const kind of kinds) {
        const source = `use { ${kind} foo } from './schema'`;
        const errors = analyze(source).getErrors();
        expect(errors).toHaveLength(0);
      }
    });

    test('should reject disallowed element kinds', () => {
      const disallowed = ['ref', 'project', 'indexes', 'checks', 'records'];
      for (const kind of disallowed) {
        const source = `use { ${kind} foo } from './schema'`;
        const errors = analyze(source).getErrors();
        expect(errors.some((e) => e.code === CompileErrorCode.INVALID_USE_SPECIFIER_KIND)).toBe(true);
      }
    });

    test('should accept note as a valid element kind', () => {
      const source = "use { note my_note } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept quoted name', () => {
      const source = 'use { table "user accounts" } from \'./schema\'';
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept multiple specifiers', () => {
      const source = "use { table users, enum status, table public.orders } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept empty specifier list', () => {
      const source = "use { } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });

    test('should accept case-insensitive element kind', () => {
      const source = "use { Table users } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(0);
    });
  });

  describe('invalid use statements — must produce errors', () => {
    test('should reject unknown element kind', () => {
      const source = "use { widget users } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_USE_SPECIFIER_KIND);
      expect(errors[0].diagnostic).toContain('widget');
    });

    test('should reject non-identifier expression as name (e.g. function call)', () => {
      const source = "use { table foo() } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_USE_SPECIFIER_NAME);
    });

    test('should report one error per invalid specifier', () => {
      const source = "use { widget foo, table bar() } from './schema'";
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(2);
      const codes = errors.map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.INVALID_USE_SPECIFIER_KIND);
      expect(codes).toContain(CompileErrorCode.INVALID_USE_SPECIFIER_NAME);
    });

    test('should report errors for multiple use statements independently', () => {
      const source = [
        "use { widget foo } from './a'",
        "use { table users } from './b'",
      ].join('\n');
      const errors = analyze(source).getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].code).toBe(CompileErrorCode.INVALID_USE_SPECIFIER_KIND);
    });
  });
});
