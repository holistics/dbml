import { describe, expect, test } from 'vitest';
import { Filepath } from '@/compiler/projectLayout';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { compileFile } from '@tests/utils/multifile';

describe('[example] multi-file: use { schema ... }', () => {
  describe('valid schema imports', () => {
    test('import schema and ref into its table', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table public.orders {
            id int [pk]
            user_id int [ref: > auth.users.id]
          }
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases[0];
      expect(mainDb.refs).toHaveLength(1);
      const ep = mainDb.refs[0].endpoints.find((e) => e.tableName === 'users')!;
      expect(ep.schemaName).toBe('auth');
    });

    test('import schema containing multiple tables', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema inventory } from './inventory.dbml'
          Table public.orders {
            id int [pk]
            product_id int [ref: > inventory.products.id]
          }
        `,
        '/inventory.dbml': `
          Table inventory.products { id int [pk] }
          Table inventory.warehouses { id int [pk] }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases[0];
      expect(mainDb.refs).toHaveLength(1);
      const ep = mainDb.refs[0].endpoints.find((e) => e.tableName === 'products')!;
      expect(ep.schemaName).toBe('inventory');
    });

    test('import multiple schemas from different files', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          use { schema billing } from './billing.dbml'
          Table public.orders {
            id int [pk]
            user_id int [ref: > auth.users.id]
            invoice_id int [ref: > billing.invoices.id]
          }
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
        '/billing.dbml': 'Table billing.invoices { id int [pk] }',
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases[0];
      expect(mainDb.refs).toHaveLength(2);
    });

    test('import schema with enums', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table public.users {
            id int [pk]
            role auth.role
          }
        `,
        '/auth.dbml': `
          Enum auth.role { admin\nuser }
          Table auth.accounts { id int [pk] }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
    });

    test('whole-file import includes schema tables', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use * from './auth.dbml'
          Table public.orders {
            id int [pk]
            user_id int [ref: > auth.users.id]
          }
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      });
      expect(report.getErrors()).toHaveLength(0);
      expect(report.getValue().databases[0].refs).toHaveLength(1);
    });
  });

  describe('schema import errors', () => {
    test('importing non-existent schema from file', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema billing } from './auth.dbml'
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      });
      expect(report.getErrors().length).toBeGreaterThan(0);
    });

    test('local and imported schemas merge when no member conflicts', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table auth.local_users { id int [pk] }
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      });
      expect(report.getErrors()).toHaveLength(0);
    });

    test('conflicting member in merged schema reports error', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table auth.users { id int [pk] }
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      });
      expect(report.getErrors().length).toBeGreaterThan(0);
      expect(report.getErrors()[0].message).toContain('conflicts with an imported definition');
    });
  });

  describe('schema import with refs', () => {
    test('inline ref to imported schema table', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table public.orders {
            id int [pk]
            user_id int [ref: > auth.users.id]
          }
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      });
      expect(report.getErrors()).toHaveLength(0);
      const ref = report.getValue().databases[0].refs[0];
      const endpoints = ref.endpoints.map((e) => `${e.schemaName}.${e.tableName}`).sort();
      expect(endpoints).toEqual(['auth.users', 'public.orders']);
    });

    test('explicit ref to imported schema table', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table public.orders {
            id int [pk]
            user_id int
          }
          Ref: public.orders.user_id > auth.users.id
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      });
      expect(report.getErrors()).toHaveLength(0);
      const ref = report.getValue().databases[0].refs[0];
      const endpoints = ref.endpoints.map((e) => `${e.schemaName}.${e.tableName}`).sort();
      expect(endpoints).toEqual(['auth.users', 'public.orders']);
    });
  });
});
