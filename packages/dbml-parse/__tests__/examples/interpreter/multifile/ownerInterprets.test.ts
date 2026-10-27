import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/index';
import { fp, setupCompiler } from './utils';

// Each declaration is interpreted by its Owner. A Ref/Dep/Records block with several Owner tables is emitted once, by its Primary Owner.
describe('[example] multifile interpreter - Owner interprets', () => {
  test('a cross-file Ref whose Primary Owner is imported is emitted exactly once', () => {
    const { compiler } = setupCompiler({
      '/posts.dbml': 'Table posts {\n  id int [pk]\n  user_id int\n}',
      '/users.dbml': 'Table users {\n  id int [pk]\n}',
      '/main.dbml': "use * from './posts.dbml'\nuse * from './users.dbml'\nRef r: posts.user_id > users.id",
    });

    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
    const db = result.getValue()! as any;
    expect(db.refs).toHaveLength(1);
    expect(db.refs[0].name).toBe('r');
  });

  test('a Ref whose left table is visible but right table is not is not emitted and reports nothing', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': 'Table users {\n  id int [pk]\n}\nTable posts {\n  id int [pk]\n  user_id int\n}\nRef r: posts.user_id > users.id',
      '/main.dbml': "use { table posts } from './orders.dbml'",
    });

    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
    expect((result.getValue()! as any).refs).toHaveLength(0);
  });

  // Tables cannot be declared inside a Project block (validator: 'Table must appear top-level'),
  // so this guards that a Program with a Project block still emits Refs owned by its tables.
  test('a Ref is still emitted when the Program also has a Project block', () => {
    const { compiler } = setupCompiler({
      '/main.dbml': `Project p {
  database_type: 'PostgreSQL'
}
Table posts {
  id int [pk]
  user_id int
}
Table users {
  id int [pk]
}
Ref: posts.user_id > users.id`,
    });

    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors()).toHaveLength(0);
    const db = result.getValue()! as any;
    expect(db.refs).toHaveLength(1);
    expect(db.project?.name).toBe('p');
  });

  test('Records for one table in two applying files report a duplicate on both and emit none', () => {
    const { compiler } = setupCompiler({
      '/base.dbml': 'Table users {\n  id int [pk]\n}',
      '/r1.dbml': "use * from './base.dbml'\nrecords users(id) {\n  1\n}",
      '/r2.dbml': "use * from './base.dbml'\nrecords users(id) {\n  2\n}",
      '/main.dbml': "use * from './base.dbml'\nuse * from './r1.dbml'\nuse * from './r2.dbml'",
    });

    const result = compiler.interpretFile(fp('/main.dbml'));
    const dups = result.getErrors().filter((e) => e.code === CompileErrorCode.DUPLICATE_RECORDS_FOR_TABLE);
    expect(dups).toHaveLength(2);
    expect(new Set(dups.map((e) => e.filepath.absolute)).size).toBe(2);
    expect((result.getValue()! as any).records).toHaveLength(0);
  });

  test('Metadata Ref targeting a Ref that does not apply reports an unknown target and attaches nothing', () => {
    const { compiler } = setupCompiler({
      '/orders.dbml': 'Table users {\n  id int [pk]\n}\nTable posts {\n  id int [pk]\n  user_id int\n}\nRef r: posts.user_id > users.id',
      '/main.dbml': "use { table posts } from './orders.dbml'\nMetadata Ref r {\n  owner: 'x'\n}",
    });

    const result = compiler.interpretFile(fp('/main.dbml'));
    expect(result.getErrors().map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Ref r`');
    expect(compiler.parse.rawDb(fp('/main.dbml'))?.refs ?? []).toHaveLength(0);

    // The defining file is unaffected
    const orders = compiler.interpretFile(fp('/orders.dbml'));
    expect(orders.getErrors()).toHaveLength(0);
    expect((orders.getValue()! as any).refs.find((r: any) => r.name === 'r')?.metadata ?? {}).toEqual({});
  });
});
