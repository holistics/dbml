import { describe, expect, test } from 'vitest';
import { compileFile } from '@tests/utils/multifile';

describe('[example] multi-file: use { enum ... }', () => {
  describe('basic enum import', () => {
    test('import enum and use as column type', () => {
      const report = compileFile({
        '/main.dbml': `
          use { enum status } from './enums.dbml'
          Table users {
            id int [pk]
            status status
          }
        `,
        '/enums.dbml': 'Enum status { active\n inactive\n pending }',
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue();
      const statusField = mainDb.tables[0].fields.find((f) => f.name === 'status')!;
      expect(statusField.type.type_name).toBe('status');
    });

    test('imported enum values are available in dependency database', () => {
      const report = compileFile({
        '/main.dbml': `
          use { enum role } from './enums.dbml'
          Table users {
            id int [pk]
            role role
          }
        `,
        '/enums.dbml': 'Enum role { admin\n user\n guest }',
      });
      expect(report.getErrors()).toHaveLength(0);
      const enumDb = report.getValue();
      const roleEnum = enumDb.enums.find((e) => e.name === 'role')!;
      expect(roleEnum.values.map((v) => v.name)).toEqual(['admin', 'user', 'guest']);
    });

    test('import multiple enums from same file', () => {
      const report = compileFile({
        '/main.dbml': `
          use { enum status, enum role } from './enums.dbml'
          Table users {
            id int [pk]
            status status
            role role
          }
        `,
        '/enums.dbml': `
          Enum status { active\n inactive }
          Enum role { admin\n user }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
    });

    test('import enums from different files', () => {
      const report = compileFile({
        '/main.dbml': `
          use { enum status } from './status.dbml'
          use { enum role } from './role.dbml'
          Table users {
            id int [pk]
            status status
            role role
          }
        `,
        '/status.dbml': 'Enum status { active\n inactive }',
        '/role.dbml': 'Enum role { admin\n user }',
      });
      expect(report.getErrors()).toHaveLength(0);
    });

    test('whole-file import includes enums', () => {
      const report = compileFile({
        '/main.dbml': `
          use * from './enums.dbml'
          Table users {
            id int [pk]
            status status
          }
        `,
        '/enums.dbml': 'Enum status { active\n inactive }',
      });
      expect(report.getErrors()).toHaveLength(0);
    });
  });

  describe('schema-qualified enum import', () => {
    test('import schema containing enum and use as column type', () => {
      const report = compileFile({
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table public.users {
            id int [pk]
            role auth.role
          }
        `,
        '/auth.dbml': 'Enum auth.role { admin\n user\n guest }',
      });
      expect(report.getErrors()).toHaveLength(0);
    });

    test('schema-qualified enum values are correct', () => {
      const report = compileFile({
        '/main.dbml': `
          use { schema billing } from './billing.dbml'
          Table public.orders {
            id int [pk]
            payment_status billing.payment_status
          }
        `,
        '/billing.dbml': 'Enum billing.payment_status { pending\n paid\n refunded }',
      });
      expect(report.getErrors()).toHaveLength(0);
      const billingDb = report.getValue();
      const psEnum = billingDb.enums.find((e) => e.name === 'payment_status')!;
      expect(psEnum.values.map((v) => v.name)).toEqual(['pending', 'paid', 'refunded']);
      expect(psEnum.schemaName).toBe('billing');
    });
  });

  describe('enum import errors', () => {
    test('duplicate enum: local definition conflicts with import', () => {
      const report = compileFile({
        '/main.dbml': `
          use { enum status } from './enums.dbml'
          Enum status { active\n inactive }
        `,
        '/enums.dbml': 'Enum status { active\n inactive }',
      });
      expect(report.getErrors().length).toBeGreaterThan(0);
    });

    test('importing non-existent enum from file', () => {
      const report = compileFile({
        '/main.dbml': `
          use { enum missing } from './enums.dbml'
          Table users { id int [pk] }
        `,
        '/enums.dbml': 'Enum status { active\n inactive }',
      });
      expect(report.getErrors().length).toBeGreaterThan(0);
      expect(report.getErrors()[0].message).toContain('missing');
    });
  });

  describe('enum with default values', () => {
    test('column with imported enum type and string default', () => {
      const report = compileFile({
        '/main.dbml': `
          use { enum status } from './enums.dbml'
          Table users {
            id int [pk]
            status status [default: 'active']
          }
        `,
        '/enums.dbml': 'Enum status { active\n inactive }',
      });
      expect(report.getErrors()).toHaveLength(0);
      const statusField = report.getValue().tables[0].fields.find((f) => f.name === 'status')!;
      expect(statusField.dbdefault).toBeDefined();
    });
  });
});
