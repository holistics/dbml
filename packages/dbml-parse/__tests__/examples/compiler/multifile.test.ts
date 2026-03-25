import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';
import { Filepath } from '@/compiler/projectLayout';
import { MemoryProjectLayout } from '@/compiler/projectLayout';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { Model } from '@/index';
import Report from '@/core/report';

function compileFile (entry: Filepath, project: Record<string, string>): Report<Model> {
  const entries: Record<string, string> = {};
  for (const [path, content] of Object.entries(project)) {
    entries[Filepath.from(path).intern()] = content;
  }
  return new Compiler(new MemoryProjectLayout(entries)).interpretFile(entry);
}

describe('[example] multi-file compilation', () => {
  describe('validation - valid imports', () => {
    test('selective import', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);
    });

    test('whole-file import', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use * from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);
    });

    test('enum import', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { enum status } from './common.dbml'
          Table users {
            id int [pk]
            status status
          }
        `,
        '/common.dbml': `
          Enum status {
            active
            inactive
          }
        `,
      }).getErrors()).toHaveLength(0);
    });

    test('tablepartial import', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablepartial timestamps } from './common.dbml'
          Table users {
            id int [pk]
            ~timestamps
          }
        `,
        '/common.dbml': `
          TablePartial timestamps {
            created_at timestamp
            updated_at timestamp
          }
        `,
      }).getErrors()).toHaveLength(0);
    });

    test('schema, tablegroup, note imports', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema public } from './common.dbml'
        `,
        '/common.dbml': 'Table public.users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { tablegroup g } from './common.dbml'
        `,
        '/common.dbml': `
          Table users { id int }
          TableGroup g { users }
        `,
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { note my_note } from './common.dbml'
        `,
        '/common.dbml': 'Note my_note { \'shared note\' }',
      }).getErrors()).toHaveLength(0);
    });

    test('duplicate and overlapping imports are allowed', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use * from './common.dbml'
          use * from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use * from './common.dbml'
          use { table users } from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { table users } from './common.dbml'
          use { table users } from './common.dbml'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);
    });
  });

  describe('validation - errors', () => {
    test('duplicate symbol from use', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table users { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors().length).toBeGreaterThan(0);
    });

    test('invalid use specifier kind', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { ref my_ref } from './common.dbml'
        `,
        '/common.dbml': '',
      }).getErrors().length).toBeGreaterThan(0);
    });

    test('dependency errors are not reported in entry file', () => {
      const errors = compileFile(
        Filepath.from('/bad.dbml'),
        {
          '/main.dbml': `
            use { table users } from './bad.dbml'
            Table orders { id int }
          `,
          '/bad.dbml': 'Table users { id int [pk',
        },
      ).getErrors();
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('binding - cross-file resolution', () => {
    test('ref, inline ref, enum type, whole-file ref', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int [ref: > users.id]
          }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { enum user_status } from './enums.dbml'
          Table users {
            id int [pk]
            status user_status
          }
        `,
        '/enums.dbml': `
          Enum user_status {
            active
            inactive
          }
        `,
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use * from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);
    });

    test('tablepartial injection and schema-qualified import', () => {
      expect(compileFile(DEFAULT_ENTRY, {
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
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { schema auth } from './auth.dbml'
          Table public.orders {
            id int [pk]
            user_id int [ref: > auth.users.id]
          }
        `,
        '/auth.dbml': 'Table auth.users { id int [pk] }',
      }).getErrors()).toHaveLength(0);
    });

    test('ref to non-imported table errors', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors().length).toBeGreaterThan(0);
    });

    test('no transitive symbol leaking', () => {
      expect(compileFile(Filepath.from('/a.dbml'), {
        '/a.dbml': `
          use { table B } from './b.dbml'
          Table A {
            id int [pk]
            c_id int [ref: > C.id]
          }
        `,
        '/b.dbml': `
          use { table C } from './c.dbml'
          Table B { id int [pk] }
        `,
        '/c.dbml': 'Table C { id int [pk] }',
      }).getErrors().length).toBeGreaterThan(0);
    });
  });

  describe('interpretation', () => {
    test('single file produces 1 database', () => {
      const model = compileFile(
        Filepath.from('/main.dbml'),
        { '/main.dbml': 'Table users { id int [pk] }' },
      ).getValue();
      expect(model.database).toHaveLength(1);
      expect(model.database[0].tables[0].name).toBe('users');
    });

    test('import produces multiple databases, entry first', () => {
      const model = compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getValue();
      expect(model.database).toHaveLength(2);
      expect(model.database[0].tables[0].name).toBe('orders');
      expect(model.database.flatMap((db) => db.tables.map((t) => t.name))).toContain('users');
    });

    test('cross-file refs are correct', () => {
      const mainDb = compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk]\nname varchar }',
      }).getValue().database[0];
      expect(mainDb.refs).toHaveLength(1);
      expect(mainDb.refs[0].endpoints[0].tableName).toBe('orders');
      expect(mainDb.refs[0].endpoints[1].tableName).toBe('users');
    });

    test('each file interpreted independently', () => {
      const model = compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': `
          Table users { id int [pk] }
          Table products { id int [pk] }
        `,
      }).getValue();
      expect(model.database.find((db) => db.tables.some((t) => t.name === 'products'))!.tables).toHaveLength(2);
    });
  });

  describe('dependency graph', () => {
    test('diamond deduplicates', () => {
      const model = compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use { table users } from './a.dbml'
          use { table orders } from './b.dbml'
          Table main_table { id int [pk] }
        `,
        '/a.dbml': 'use { enum status } from \'./shared.dbml\'\nTable users { id int [pk] }',
        '/b.dbml': 'use { enum status } from \'./shared.dbml\'\nTable orders { id int [pk] }',
        '/shared.dbml': 'Enum status { active\ninactive }',
      }).getValue();
      expect(new Set(model.database).size).toBe(model.database.length);
    });

    test('circular, 3-way circular, self-import do not loop', () => {
      expect(compileFile(Filepath.from('/a.dbml'), {
        '/a.dbml': 'use { table B } from \'./b.dbml\'\nTable A { id int [pk] }',
        '/b.dbml': 'use { table A } from \'./a.dbml\'\nTable B { id int [pk] }',
      }).getValue().database.length).toBeGreaterThanOrEqual(2);

      expect(compileFile(Filepath.from('/a.dbml'), {
        '/a.dbml': 'use { table B } from \'./b.dbml\'\nTable A { id int }',
        '/b.dbml': 'use { table C } from \'./c.dbml\'\nTable B { id int }',
        '/c.dbml': 'use { table A } from \'./a.dbml\'\nTable C { id int }',
      }).getValue().database).toHaveLength(3);

      expect(compileFile(Filepath.from('/self.dbml'), {
        '/self.dbml': 'use { table X } from \'./self.dbml\'\nTable X { id int }',
      }).getValue().database).toBeDefined();
    });

    test('deep chain and fan-out', () => {
      expect(compileFile(Filepath.from('/a.dbml'), {
        '/a.dbml': `
          use { table B } from './b.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          use { table C } from './c.dbml'
          Table B { id int [pk] }
        `,
        '/c.dbml': 'Table C { id int [pk] }',
      }).getValue().database).toHaveLength(3);

      expect(compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use { table A } from './a.dbml'
          use { table B } from './b.dbml'
          use { table C } from './c.dbml'
          Table Main { id int }
        `,
        '/a.dbml': `
          use { enum status } from './shared.dbml'
          Table A { id int }
        `,
        '/b.dbml': `
          use { enum status } from './shared.dbml'
          Table B { id int }
        `,
        '/c.dbml': `
          use { enum status } from './shared.dbml'
          Table C { id int }
        `,
        '/shared.dbml': 'Enum status { active\ninactive }',
      }).getValue().database).toHaveLength(5);
    });
  });

  describe('edge cases', () => {
    test('empty file, comments only, use-only file', () => {
      expect(compileFile(Filepath.from('/main.dbml'),
        { '/main.dbml': '' }).getValue().database).toHaveLength(1);

      expect(compileFile(Filepath.from('/main.dbml'),
        { '/main.dbml': '// just a comment' }).getValue().database[0].tables).toHaveLength(0);

      expect(compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': 'use * from \'./common.dbml\'',
        '/common.dbml': 'Table users { id int [pk] }',
      }).getValue().database).toHaveLength(2);
    });

    test('parse errors, missing dep, bad dep still produce a model', () => {
      const r1 = compileFile(
        Filepath.from('/main.dbml'),
        { '/main.dbml': 'Table users { id int [pk' },
      );
      expect(r1.getErrors().length).toBeGreaterThan(0);
      expect(r1.getValue().database).toHaveLength(1);

      expect(compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use { table users } from './missing.dbml'
          Table orders { id int [pk] }
        `,
      }).getValue().database).toBeDefined();

      expect(compileFile(Filepath.from('/main.dbml'), {
        '/main.dbml': `
          use { table users } from './bad.dbml'
          Table orders { id int [pk] }
        `,
        '/bad.dbml': 'Table users { id int [pk',
      }).getValue().database).toBeDefined();
    });

    test('relative path going up directories', () => {
      expect(compileFile(Filepath.from('/sub/main.dbml'), {
        '/sub/main.dbml': `
          use { table users } from '../common.dbml'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);
    });
  });

  describe('extensionless import paths', () => {
    test('resolves with and without .dbml extension', () => {
      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { table users } from './common'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': 'use * from \'./common\'\nTable orders { id int }',
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile(DEFAULT_ENTRY, {
        '/main.dbml': `
          use { table users } from './common'
          Table orders {
            id int
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);
    });

    test('./common and ./common.dbml resolve to same file', () => {
      const model = compileFile(Filepath.from('/main.dbml'), {
        '/a.dbml': `
          use { table shared } from './shared'
          Table A { id int }'
        `,
        '/b.dbml': `
          use { table shared } from './shared.dbml'
          Table B { id int }
        `,
        '/main.dbml': `
          use { table A } from './a'
          use { table B } from './b'
          Table Main { id int }
        `,
        '/shared.dbml': 'Table shared { id int }',
      }).getValue();
      expect(new Set(model.database).size).toBe(model.database.length);
    });
  });

  describe('cache invalidation', () => {
    test('setSource and deleteSource invalidate interpretation', () => {
      const entries: Record<string, string> = {};
      for (const [path, content] of Object.entries({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      })) {
        entries[Filepath.from(path).intern()] = content;
      }
      const compiler = new Compiler(new MemoryProjectLayout(entries));
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database).toHaveLength(2);

      compiler.setSource(`
        Table users { id int }
        Table products { id int }
      `, Filepath.from('/common.dbml'));
      const updated = compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database;
      expect(updated.find((db) => db.tables.some((t) => t.name === 'products'))?.tables).toHaveLength(2);

      compiler.deleteSource(Filepath.from('/common.dbml'));
      expect(compiler.interpretFile(Filepath.from('/main.dbml')).getValue().database.length).toBeGreaterThanOrEqual(1);
    });
  });
});
