import { describe, expect, test } from 'vitest';
import { Filepath } from '@/compiler/projectLayout';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { compileFile } from '@tests/utils/multifile';

describe('[example] multi-file: use { tablepartial ... } and inject', () => {
  describe('basic cross-file injection', () => {
    test('imported tablepartial is available in the entry database', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablepartial timestamps } from './partials.dbml'
          Table users {
            id int [pk]
            ~timestamps
          }
        `,
        '/partials.dbml': `
          TablePartial timestamps {
            created_at timestamp
            updated_at timestamp
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases[0];
      const users = mainDb.tables.find((t) => t.name === 'users')!;
      expect(users.fields.map((f) => f.name)).toEqual(['id']);
      expect(users.partials.map((p) => p.name)).toEqual(['timestamps']);
      const tp = mainDb.tablePartials.find((p) => p.name === 'timestamps')!;
      expect(tp).toBeDefined();
      expect(tp.fields.map((f) => f.name)).toEqual(['created_at', 'updated_at']);
    });

    test('inject into multiple tables from same import', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablepartial timestamps } from './partials.dbml'
          Table users {
            id int [pk]
            ~timestamps
          }
          Table orders {
            id int [pk]
            ~timestamps
          }
        `,
        '/partials.dbml': `
          TablePartial timestamps {
            created_at timestamp
            updated_at timestamp
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases[0];
      for (const table of mainDb.tables) {
        expect(table.partials.map((p) => p.name)).toContain('timestamps');
      }
      expect(mainDb.tablePartials.find((p) => p.name === 'timestamps')).toBeDefined();
    });

    test('import multiple tablepartials from same file', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablepartial timestamps, tablepartial soft_delete } from './partials.dbml'
          Table users {
            id int [pk]
            ~timestamps
            ~soft_delete
          }
        `,
        '/partials.dbml': `
          TablePartial timestamps {
            created_at timestamp
            updated_at timestamp
          }
          TablePartial soft_delete {
            deleted_at timestamp
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases[0];
      const users = mainDb.tables.find((t) => t.name === 'users')!;
      expect(users.partials.map((p) => p.name)).toEqual(['timestamps', 'soft_delete']);
      expect(mainDb.tablePartials.map((p) => p.name).sort()).toEqual(['soft_delete', 'timestamps']);
    });

    test('import tablepartials from different files', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablepartial timestamps } from './time.dbml'
          use { tablepartial audit } from './audit.dbml'
          Table users {
            id int [pk]
            ~timestamps
            ~audit
          }
        `,
        '/time.dbml': `
          TablePartial timestamps {
            created_at timestamp
            updated_at timestamp
          }
        `,
        '/audit.dbml': `
          TablePartial audit {
            created_by int
            updated_by int
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases[0];
      const users = mainDb.tables.find((t) => t.name === 'users')!;
      expect(users.partials.map((p) => p.name)).toEqual(['timestamps', 'audit']);
      expect(mainDb.tablePartials.map((p) => p.name).sort()).toEqual(['audit', 'timestamps']);
    });

    test('whole-file import includes tablepartials', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use * from './partials.dbml'
          Table users {
            id int [pk]
            ~timestamps
          }
        `,
        '/partials.dbml': `
          TablePartial timestamps {
            created_at timestamp
            updated_at timestamp
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases[0];
      expect(mainDb.tables[0].partials.map((p) => p.name)).toEqual(['timestamps']);
      expect(mainDb.tablePartials.find((p) => p.name === 'timestamps')).toBeDefined();
    });
  });

  describe('tablepartial import with table partial fields', () => {
    test('imported partial fields have correct types', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablepartial typed_fields } from './partials.dbml'
          Table users {
            id int [pk]
            ~typed_fields
          }
        `,
        '/partials.dbml': `
          TablePartial typed_fields {
            name varchar(255) [not null]
            age int
            active boolean [default: true]
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const tp = report.getValue().databases[0].tablePartials.find((p) => p.name === 'typed_fields')!;
      expect(tp.fields).toHaveLength(3);
      expect(tp.fields.map((f) => f.name)).toEqual(['name', 'age', 'active']);
      expect(tp.fields[0].type.type_name).toContain('varchar');
    });

    test('imported partial with indexes', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablepartial with_indexes } from './partials.dbml'
          Table users {
            id int [pk]
            ~with_indexes
          }
        `,
        '/partials.dbml': `
          TablePartial with_indexes {
            email varchar [unique]
            name varchar

            indexes {
              email
            }
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
    });
  });

  describe('tablepartial import errors', () => {
    test('inject non-existent tablepartial from import', () => {
      const report = compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablepartial missing } from './partials.dbml'
          Table users {
            id int [pk]
            ~missing
          }
        `,
        '/partials.dbml': `
          TablePartial timestamps {
            created_at timestamp
          }
        `,
      });
      expect(report.getErrors().length).toBeGreaterThan(0);
    });
  });

  describe('circular tablepartial imports', () => {
    test('two files importing each others tablepartials', () => {
      const report = compileFile(Filepath.from('/a.dbml'), {
        '/a.dbml': `
          use { tablepartial bp } from './b.dbml'
          TablePartial ap { a_field int }
          Table A { id int [pk]\n~bp }
        `,
        '/b.dbml': `
          use { tablepartial ap } from './a.dbml'
          TablePartial bp { b_field int }
          Table B { id int [pk]\n~ap }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const dbs = report.getValue().databases;
      expect(dbs).toHaveLength(2);

      const dbA = dbs.find((db) => db.filepath.absolute === '/a.dbml')!;
      const dbB = dbs.find((db) => db.filepath.absolute === '/b.dbml')!;

      // A injects bp — bp is available because b.dbml is interpreted first (dependency order)
      expect(dbA.tables[0].partials.map((p) => p.name)).toEqual(['bp']);
      expect(dbA.tablePartials.map((p) => p.name).sort()).toEqual(['ap', 'bp']);

      // B injects ap
      expect(dbB.tables[0].partials.map((p) => p.name)).toEqual(['ap']);
    });

    test('self-referential tablepartial import produces duplicate name error', () => {
      const report = compileFile(Filepath.from('/self.dbml'), {
        '/self.dbml': `
          use { tablepartial tp } from './self.dbml'
          TablePartial tp { some_field int }
          Table T { id int [pk]\n~tp }
        `,
      });
      expect(report.getErrors().length).toBeGreaterThan(0);
    });

    test('3-way circular tablepartial import does not loop', () => {
      const report = compileFile(Filepath.from('/a.dbml'), {
        '/a.dbml': `
          use { tablepartial cp } from './c.dbml'
          TablePartial ap { a_col int }
          Table A { id int [pk]\n~cp }
        `,
        '/b.dbml': `
          use { tablepartial ap } from './a.dbml'
          TablePartial bp { b_col int }
          Table B { id int [pk]\n~ap }
        `,
        '/c.dbml': `
          use { tablepartial bp } from './b.dbml'
          TablePartial cp { c_col int }
          Table C { id int [pk]\n~bp }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const dbs = report.getValue().databases;
      expect(dbs).toHaveLength(3);

      for (const db of dbs) {
        expect(db.tables).toHaveLength(1);
        expect(db.tables[0].partials).toHaveLength(1);
      }
    });

    test('chain: A imports partial from B, B imports partial from C', () => {
      const report = compileFile(Filepath.from('/a.dbml'), {
        '/a.dbml': `
          use { tablepartial bp } from './b.dbml'
          Table A { id int [pk]\n~bp }
        `,
        '/b.dbml': `
          use { tablepartial cp } from './c.dbml'
          TablePartial bp { b_col int }
          Table B { id int [pk]\n~cp }
        `,
        '/c.dbml': `
          TablePartial cp { c_col int }
          Table C { id int [pk] }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const dbs = report.getValue().databases;
      expect(dbs).toHaveLength(3);

      const dbA = dbs.find((db) => db.filepath.absolute === '/a.dbml')!;
      // A should see bp (from B) in its tablePartials
      expect(dbA.tables[0].partials.map((p) => p.name)).toEqual(['bp']);
      expect(dbA.tablePartials.some((p) => p.name === 'bp')).toBe(true);
      // bp should have b_col
      const bp = dbA.tablePartials.find((p) => p.name === 'bp')!;
      expect(bp.fields.map((f) => f.name)).toEqual(['b_col']);
    });
  });

  describe('cross-file partial with refs back to importing table', () => {
    test('table refs external table that is injected with external partial referencing back', () => {
      // a.dbml: Table users, refs orders.user_id
      // b.dbml: Table orders, injects ~user_ref from p.dbml
      // p.dbml: TablePartial user_ref { user_id int [ref: > users.id] }, imports users from a.dbml
      const report = compileFile(Filepath.from('/a.dbml'), {
        '/a.dbml': `
          use { table orders } from './b.dbml'
          Table users {
            id int [pk]
            name varchar
          }
          Ref: users.id < orders.user_id
        `,
        '/b.dbml': `
          use { tablepartial user_ref } from './p.dbml'
          Table orders {
            id int [pk]
            ~user_ref
          }
        `,
        '/p.dbml': `
          use { table users } from './a.dbml'
          TablePartial user_ref {
            user_id int [ref: > users.id]
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const dbs = report.getValue().databases;
      expect(dbs).toHaveLength(3);

      const dbA = dbs.find((db) => db.filepath.absolute === '/a.dbml')!;
      const dbB = dbs.find((db) => db.filepath.absolute === '/b.dbml')!;

      // a.dbml has the explicit Ref from users to orders
      expect(dbA.refs).toHaveLength(1);
      const refEndpoints = dbA.refs[0].endpoints.map((e) => e.tableName).sort();
      expect(refEndpoints).toEqual(['orders', 'users']);

      // b.dbml's orders table has the user_ref partial injection
      const orders = dbB.tables.find((t) => t.name === 'orders')!;
      expect(orders.partials.map((p) => p.name)).toEqual(['user_ref']);

      // The user_ref partial has user_id field
      const userRefPartial = dbB.tablePartials.find((p) => p.name === 'user_ref')!;
      expect(userRefPartial).toBeDefined();
      expect(userRefPartial.fields.map((f) => f.name)).toEqual(['user_id']);
    });

    test('partial with inline ref to table in another file via whole-file import', () => {
      const report = compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use * from './partials.dbml'
          use * from './tables.dbml'
          Table main_table {
            id int [pk]
            ~fk_partial
          }
        `,
        '/tables.dbml': `
          Table target {
            id int [pk]
            name varchar
          }
        `,
        '/partials.dbml': `
          use { table target } from './tables.dbml'
          TablePartial fk_partial {
            target_id int [ref: > target.id]
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const dbs = report.getValue().databases;
      const mainDb = dbs.find((db) => db.filepath.absolute === '/main.dbml')!;
      expect(mainDb.tables[0].partials.map((p) => p.name)).toEqual(['fk_partial']);
      expect(mainDb.tablePartials.some((p) => p.name === 'fk_partial')).toBe(true);
    });

    test('diamond: two tables inject partials that both ref the same external table', () => {
      const report = compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use { table shared } from './shared.dbml'
          use { tablepartial ref_shared } from './partials.dbml'
          Table alpha {
            id int [pk]
            ~ref_shared
          }
          Table beta {
            id int [pk]
            ~ref_shared
          }
        `,
        '/shared.dbml': 'Table shared { id int [pk] }',
        '/partials.dbml': `
          use { table shared } from './shared.dbml'
          TablePartial ref_shared {
            shared_id int [ref: > shared.id]
          }
        `,
      });
      expect(report.getErrors()).toHaveLength(0);
      const mainDb = report.getValue().databases.find((db) => db.filepath.absolute === '/main.dbml')!;
      expect(mainDb.tables).toHaveLength(2);
      for (const t of mainDb.tables) {
        expect(t.partials.map((p) => p.name)).toEqual(['ref_shared']);
      }
      expect(mainDb.tablePartials.some((p) => p.name === 'ref_shared')).toBe(true);
    });
  });
});
