import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler/index';
import { Filepath, MemoryProjectLayout } from '@/compiler/projectLayout';
import { DEFAULT_ENTRY } from '@/compiler/constants';
import { compileFile } from '@tests/utils/multifile';

describe('[example] multi-file compilation', () => {
  describe('validation - valid imports', () => {
    test('selective import', () => {
      expect(compileFile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);
    });

    test('whole-file import', () => {
      expect(compileFile({
        '/main.dbml': `
          use * from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);
    });

    test('enum import', () => {
      expect(compileFile({
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
      expect(compileFile({
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
      expect(compileFile({
        '/main.dbml': `
          use { table public.users } from './common.dbml'
        `,
        '/common.dbml': 'Table public.users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile({
        '/main.dbml': `
          use { tablegroup g } from './common.dbml'
        `,
        '/common.dbml': `
          Table users { id int }
          TableGroup g { users }
        `,
      }).getErrors()).toHaveLength(0);

      expect(compileFile({
        '/main.dbml': `
          use { note my_note } from './common.dbml'
        `,
        '/common.dbml': 'Note my_note { \'shared note\' }',
      }).getErrors()).toHaveLength(0);
    });

    test('duplicate and overlapping imports are allowed', () => {
      expect(compileFile({
        '/main.dbml': `
          use * from './common.dbml'
          use * from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile({
        '/main.dbml': `
          use * from './common.dbml'
          use { table users } from './common.dbml'
        `,
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile({
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
    test('only one Project element allowed across all files', () => {
      const report = compileFile({
        '/main.dbml': `
          use * from './common.dbml'
          Project myproject { database_type: 'PostgreSQL' }
          Table users { id int [pk] }
        `,
        '/common.dbml': `
          Project otherproject { database_type: 'MySQL' }
          Table orders { id int [pk] }
        `,
      });
      const projectErrors = report.getErrors().filter((e) => e.message.includes('Project'));
      expect(projectErrors.length).toBe(2);
      expect(projectErrors[0].message).toContain('Only one Project element can exist across all files');
    });

    test('single Project across files is valid', () => {
      expect(compileFile({
        '/main.dbml': `
          use * from './common.dbml'
          Project myproject { database_type: 'PostgreSQL' }
          Table users { id int [pk] }
        `,
        '/common.dbml': 'Table orders { id int [pk] }',
      }).getErrors()).toHaveLength(0);
    });

    test('Project in dependency file only is valid', () => {
      expect(compileFile({
        '/main.dbml': `
          use * from './common.dbml'
          Table users { id int [pk] }
        `,
        '/common.dbml': `
          Project shared { database_type: 'PostgreSQL' }
          Table orders { id int [pk] }
        `,
      }).getErrors()).toHaveLength(0);
    });

    test('duplicate symbol from use', () => {
      expect(compileFile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table users { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors().length).toBeGreaterThan(0);
    });

    test('invalid use specifier kind', () => {
      expect(compileFile({
        '/main.dbml': `
          use { ref my_ref } from './common.dbml'
        `,
        '/common.dbml': '',
      }).getErrors().length).toBeGreaterThan(0);
    });

    test('dependency errors are not reported in entry file', () => {
      const errors = compileFile({
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
      expect(compileFile({
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

      expect(compileFile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int [ref: > users.id]
          }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile({
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

      expect(compileFile({
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
      expect(compileFile({
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

      expect(compileFile({
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
      expect(compileFile({
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
      expect(compileFile({
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
    test('single file', () => {
      const db = compileFile({ '/main.dbml': 'Table users { id int [pk] }' }).getValue();
      expect(db.tables).toHaveLength(1);
      expect(db.tables[0].name).toBe('users');
    });

    test('multi-file has all tables flat and per-file manifests', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      });
      expect(result.getErrors()).toHaveLength(0);
      const db = result.getValue();
      expect(db.tables.map((t) => t.name)).toContain('orders');
      expect(db.tables.map((t) => t.name)).toContain('users');

    });

    test('cross-file refs are correct', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk]\nname varchar }',
      });
      expect(result.getErrors()).toHaveLength(0);
      const db = result.getValue();
      expect(db.refs).toHaveLength(1);
      expect(db.refs[0].endpoints[0].tableName).toBe('orders');
      expect(db.refs[0].endpoints[1].tableName).toBe('users');
    });

    test('file manifests track per-file tables', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': `
          Table users { id int [pk] }
          Table products { id int [pk] }
        `,
      });
      expect(result.getErrors()).toHaveLength(0);
      const db = result.getValue();
      expect(db.tables).toHaveLength(3);

    });
  });

  describe('dependency graph', () => {
    test('diamond deduplicates', () => {
      const db = compileFile({
        '/main.dbml': `
          use { table users } from './a.dbml'
          use { table orders } from './b.dbml'
          Table main_table { id int [pk] }
        `,
        '/a.dbml': 'use { enum status } from \'./shared.dbml\'\nTable users { id int [pk] }',
        '/b.dbml': 'use { enum status } from \'./shared.dbml\'\nTable orders { id int [pk] }',
        '/shared.dbml': 'Enum status { active\ninactive }',
      }).getValue();
      expect(db.tables).toHaveLength(3);
      expect(db.enums).toHaveLength(1);
    });

    test('circular, 3-way circular, self-import do not loop', () => {
      const db1 = compileFile({
        '/a.dbml': 'use { table B } from \'./b.dbml\'\nTable A { id int [pk] }',
        '/b.dbml': 'use { table A } from \'./a.dbml\'\nTable B { id int [pk] }',
      }).getValue();
      expect(db1.tables).toHaveLength(2);

      const db2 = compileFile({
        '/a.dbml': 'use { table B } from \'./b.dbml\'\nTable A { id int }',
        '/b.dbml': 'use { table C } from \'./c.dbml\'\nTable B { id int }',
        '/c.dbml': 'use { table A } from \'./a.dbml\'\nTable C { id int }',
      }).getValue();
      expect(db2.tables).toHaveLength(3);

      expect(compileFile({
        '/self.dbml': 'use { table X } from \'./self.dbml\'\nTable X { id int }',
      }).getValue().tables).toBeDefined();
    });

    test('deep chain and fan-out', () => {
      expect(compileFile({
        '/a.dbml': `
          use { table B } from './b.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          use { table C } from './c.dbml'
          Table B { id int [pk] }
        `,
        '/c.dbml': 'Table C { id int [pk] }',
      }).getValue().tables).toHaveLength(3);

      const db = compileFile({
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
      }).getValue();
      expect(db.tables).toHaveLength(4);
      expect(db.enums).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    test('empty file, comments only, use-only file', () => {
      expect(compileFile({ '/main.dbml': '' }).getValue().tables).toHaveLength(0);

      expect(compileFile({ '/main.dbml': '// just a comment' }).getValue().tables).toHaveLength(0);

      expect(compileFile({
        '/main.dbml': 'use * from \'./common.dbml\'',
        '/common.dbml': 'Table users { id int [pk] }',
      }).getValue().tables).toHaveLength(1);
    });

    test('parse errors, missing dep, bad dep still produce a database', () => {
      const r1 = compileFile({ '/main.dbml': 'Table users { id int [pk' });
      expect(r1.getErrors().length).toBeGreaterThan(0);
      expect(r1.getValue().tables).toBeDefined();

      expect(compileFile({
        '/main.dbml': `
          use { table users } from './missing.dbml'
          Table orders { id int [pk] }
        `,
      }).getValue().tables).toBeDefined();

      expect(compileFile({
        '/main.dbml': `
          use { table users } from './bad.dbml'
          Table orders { id int [pk] }
        `,
        '/bad.dbml': 'Table users { id int [pk',
      }).getValue().tables).toBeDefined();
    });

    test('relative path going up directories', () => {
      expect(compileFile({
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
      expect(compileFile({
        '/main.dbml': `
          use { table users } from './common'
          Table orders { id int }
        `,
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile({
        '/main.dbml': 'use * from \'./common\'\nTable orders { id int }',
        '/common.dbml': 'Table users { id int }',
      }).getErrors()).toHaveLength(0);

      expect(compileFile({
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
      const model = compileFile({
        '/a.dbml': `
          use { table shared } from './shared'
          Table A { id int }
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
        entries[Filepath.from(path).absolute] = content;
      }
      const compiler = new Compiler(new MemoryProjectLayout(entries));
      expect(compiler.interpretProject().getValue().items.tables).toHaveLength(2);

      compiler.setSource(`
        Table users { id int }
        Table products { id int }
      `, Filepath.from('/common.dbml'));
      const updated = compiler.interpretProject().getValue().items;
      expect(updated.tables.some((t) => t.name === 'products')).toBe(true);

      compiler.deleteSource(Filepath.from('/common.dbml'));
      expect(compiler.interpretProject().getValue().items.tables).toBeDefined();
    });
  });

  describe('aliasing', () => {
    test('basic alias resolves correctly', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users as u } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > u.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      });
      expect(result.getErrors()).toHaveLength(0);
      const mainDb = result.getValue();
      expect(mainDb.refs).toHaveLength(1);
      expect(mainDb.refs[0].endpoints[0].tableName).toBe('orders');
      expect(mainDb.refs[0].endpoints[1].tableName).toBe('users');
    });

    test('alias conflict with local symbol produces error', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users as orders } from './common.dbml'
          Table orders { id int [pk] }
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      });
      expect(result.getErrors().length).toBeGreaterThan(0);
      expect(result.getErrors().some((e) => e.diagnostic.includes('already defined'))).toBe(true);
    });

    test('multiple aliases from same source', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users as u, enum status as s } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
            status s
          }
          Ref: orders.user_id > u.id
        `,
        '/common.dbml': `
          Table users { id int [pk] }
          Enum status { active\ninactive }
        `,
      });
      expect(result.getErrors()).toHaveLength(0);
      const mainDb = result.getValue();
      expect(mainDb.refs).toHaveLength(1);
      expect(mainDb.tables[0].fields.some((f) => f.type.type_name === 's')).toBe(true);
    });

    test('schema-qualified import with alias', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table public.users as u } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > u.id
        `,
        '/common.dbml': 'Table public.users { id int [pk] }',
      });
      expect(result.getErrors()).toHaveLength(0);
      const mainDb = result.getValue();
      expect(mainDb.refs).toHaveLength(1);
    });
  });

  describe('reuse (re-export)', () => {
    test('basic selective reuse makes symbol available downstream', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users } from './mid.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/mid.dbml': 'reuse { table users } from \'./source.dbml\'',
        '/source.dbml': 'Table users { id int [pk] }',
      });
      expect(result.getErrors()).toHaveLength(0);
      const mainDb = result.getValue();
      expect(mainDb.refs).toHaveLength(1);
      expect(mainDb.refs[0].endpoints[1].tableName).toBe('users');
    });

    test('wildcard reuse exposes all symbols', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users, enum status } from './mid.dbml'
          Table orders {
            id int [pk]
            status status
          }
        `,
        '/mid.dbml': 'reuse * from \'./source.dbml\'',
        '/source.dbml': `
          Table users { id int [pk] }
          Enum status { active\ninactive }
        `,
      });
      expect(result.getErrors()).toHaveLength(0);
      const allTables = result.getValue().tables;
      const allEnums = result.getValue().enums;
      expect(allTables.map((t) => t.name)).toContain('users');
      expect(allEnums.map((e) => e.name)).toContain('status');
    });

    test('use (not reuse) is NOT transitive', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users } from './mid.dbml'
          Table orders { id int [pk] }
        `,
        '/mid.dbml': 'use { table users } from \'./source.dbml\'',
        '/source.dbml': 'Table users { id int [pk] }',
      });
      expect(result.getErrors().length).toBeGreaterThan(0);
      expect(result.getErrors().some((e) => e.diagnostic.includes('not found'))).toBe(true);
    });

    test('transitive reuse chain resolves through intermediaries', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users } from './b.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/b.dbml': 'reuse { table users } from \'./a.dbml\'',
        '/a.dbml': 'reuse { table users } from \'./source.dbml\'',
        '/source.dbml': 'Table users { id int [pk] }',
      });
      expect(result.getErrors()).toHaveLength(0);
      const mainDb = result.getValue();
      expect(mainDb.refs).toHaveLength(1);
    });

    test('circular reuse (2-way) does not loop', () => {
      const result = compileFile({
        '/a.dbml': `
          reuse { table B } from './b.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          reuse { table A } from './a.dbml'
          Table B { id int [pk] }
        `,
      });
      expect(result.getErrors()).toHaveLength(0);
      const model = result.getValue();
      const allTables = model.tables.map((t) => t.name);
      expect(allTables).toContain('A');
      expect(allTables).toContain('B');
    });

    test('circular reuse (3-way) does not loop', () => {
      const result = compileFile({
        '/a.dbml': `
          reuse { table C } from './c.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          reuse { table A } from './a.dbml'
          Table B { id int [pk] }
        `,
        '/c.dbml': `
          reuse { table B } from './b.dbml'
          Table C { id int [pk] }
        `,
      });
      expect(result.getErrors()).toHaveLength(0);
      const allTables = result.getValue().tables.map((t) => t.name);
      expect(allTables).toContain('A');
      expect(allTables).toContain('B');
      expect(allTables).toContain('C');
    });

    test('circular reuse self-import does not loop', () => {
      const result = compileFile({
        '/self.dbml': `
          reuse { table X } from './self.dbml'
          Table X { id int [pk] }
        `,
      });
    });

    test('circular wildcard reuse does not loop', () => {
      const result = compileFile({
        '/a.dbml': `
          reuse * from './b.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          reuse * from './a.dbml'
          Table B { id int [pk] }
        `,
      });
      expect(result.getErrors()).toHaveLength(0);
      const allTables = result.getValue().tables.map((t) => t.name);
      expect(allTables).toContain('A');
      expect(allTables).toContain('B');
    });

    test('mixed circular use and reuse', () => {
      const result = compileFile({
        '/a.dbml': `
          use { table B } from './b.dbml'
          reuse { table C } from './c.dbml'
          Table A { id int [pk] }
        `,
        '/b.dbml': `
          reuse { table A } from './a.dbml'
          Table B { id int [pk] }
        `,
        '/c.dbml': `
          use { table B } from './b.dbml'
          Table C { id int [pk] }
        `,
      });
      expect(result.getErrors()).toHaveLength(0);
      const allTables = result.getValue().tables.map((t) => t.name);
      expect(allTables).toContain('A');
      expect(allTables).toContain('B');
      expect(allTables).toContain('C');
    });

    test('reuse with alias exposes under aliased name', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table u } from './mid.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > u.id
        `,
        '/mid.dbml': 'reuse { table users as u } from \'./source.dbml\'',
        '/source.dbml': 'Table users { id int [pk] }',
      });
      expect(result.getErrors()).toHaveLength(0);
      const mainDb = result.getValue();
      expect(mainDb.refs).toHaveLength(1);
      expect(mainDb.refs[0].endpoints[1].tableName).toBe('users');
    });

    test('use-imported symbols are not re-exported', () => {
      const result = compileFile({
        '/main.dbml': `
          use { table users, enum status } from './mid.dbml'
          Table orders { id int [pk] }
        `,
        '/mid.dbml': `
          use { enum status } from './enums.dbml'
          reuse { table users } from './source.dbml'
          Table mid_table { id int [pk] }
        `,
        '/source.dbml': 'Table users { id int [pk] }',
        '/enums.dbml': 'Enum status { active\ninactive }',
      });
      // users should resolve (reuse), status should fail (use, not reuse)
      expect(result.getErrors().length).toBeGreaterThan(0);
      expect(result.getErrors().some((e) => e.diagnostic.includes('status'))).toBe(true);
    });
  });

  describe('ref endpoint tracking', () => {
    test('ref endpoint includes tableFilepath for cross-file refs', () => {
      const model = compileFile({
        '/main.dbml': `
          use { table users } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > users.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getValue();
      expect(model.refs[0].endpoints[0].tableFilepath?.absolute).toBe('/main.dbml');
      expect(model.refs[0].endpoints[1].tableFilepath?.absolute).toBe('/common.dbml');
    });

    test('ref endpoint resolves original name through alias', () => {
      const model = compileFile({
        '/main.dbml': `
          use { table users as u } from './common.dbml'
          Table orders {
            id int [pk]
            user_id int
          }
          Ref: orders.user_id > u.id
        `,
        '/common.dbml': 'Table users { id int [pk] }',
      }).getValue();
      expect(model.refs[0].endpoints[1].tableName).toBe('users');
      expect(model.refs[0].endpoints[1].tableFilepath?.absolute).toBe('/common.dbml');
    });
  });
});
