import { describe, expect, test } from 'vitest';
import { setupCompiler, fp, getCanonicalName } from '../interpreter/multifile/utils';

describe('getCanonicalName - basics', () => {
  const { compiler } = setupCompiler({
    '/main.dbml': 'Table users { id int [pk] }\nTable auth.posts { id int [pk] }',
  });

  test('local table', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'users')).toEqual({ schema: 'public', name: 'users' });
  });

  test('schema-qualified table', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'posts')).toEqual({ schema: 'auth', name: 'posts' });
  });
});

describe('getCanonicalName - import with and without alias', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk] }\nTable auth.posts { id int [pk] }',
    '/main.dbml': [
      "use { table users } from './base.dbml'",
      "use { table users as u } from './base.dbml'",
      "use { table auth.posts } from './base.dbml'",
      "use { table auth.posts as p } from './base.dbml'",
    ].join('\n'),
  });

  test('non-aliased keeps original', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'users')).toEqual({ schema: 'public', name: 'users' });
  });

  test('`u` resolves to real name when `users` also imported', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'u')).toEqual({ schema: 'public', name: 'users' });
  });

  test('schema-qualified: `p` at program level found first', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'posts')).toEqual({ schema: '', name: 'p' });
    expect(getCanonicalName(compiler, '/main.dbml', 'p')).toEqual({ schema: '', name: 'p' });
  });
});

describe('getCanonicalName - multiple aliases, first wins', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk] }',
    '/main.dbml': "use { table users as a } from './base.dbml'\nuse { table users as b } from './base.dbml'",
  });

  test('both `a` and `b` resolve to first alias `a`', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'a')).toEqual({ schema: '', name: 'a' });
    expect(getCanonicalName(compiler, '/main.dbml', 'b')).toEqual({ schema: '', name: 'a' });
  });
});

describe('getCanonicalName - alias alongside real name', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk] }',
    '/main.dbml': "use { table users } from './base.dbml'\nuse { table users as u } from './base.dbml'",
  });

  test('real name `users` wins over alias `u`', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'users')).toEqual({ schema: 'public', name: 'users' });
  });
});

describe('getCanonicalName - alias flattens nested schema', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table x.y.items { id int [pk] }',
    '/main.dbml': "use { table x.y.items as flat } from './base.dbml'",
  });

  test('`flat` strips nested `x.y` schema', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'flat')).toEqual({ schema: '', name: 'flat' });
  });
});

describe('getCanonicalName - same symbol, 2 paths, different aliases', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk] }',
    '/alt.dbml': "reuse { table users } from './base.dbml'",
    '/main.dbml': "use { table users as a } from './base.dbml'\nuse { table users as b } from './alt.dbml'",
  });

  test('first alias `a` wins regardless of path', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'a')).toEqual({ schema: '', name: 'a' });
    expect(getCanonicalName(compiler, '/main.dbml', 'b')).toEqual({ schema: '', name: 'a' });
  });
});

describe('getCanonicalName - same real name, 2 paths, deduplicates', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk] }',
    '/alt.dbml': "reuse { table users } from './base.dbml'",
    '/main.dbml': "use { table users } from './base.dbml'\nuse { table users } from './alt.dbml'",
  });

  test('one table, no errors', () => {
    const r = compiler.interpretFile(fp('/main.dbml'));
    expect(r.getErrors()).toHaveLength(0);
    expect(r.getValue()!.tables.filter((t: any) => t.name === 'users')).toHaveLength(1);
  });

  test('canonical name is `users`', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'users')).toEqual({ schema: 'public', name: 'users' });
  });
});

describe('getCanonicalName - transitive reuse', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk] }',
    '/mid.dbml': "reuse { table users } from './base.dbml'",
    '/main.dbml': "use { table users } from './mid.dbml'",
  });

  test('preserves original name', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'users')).toEqual({ schema: 'public', name: 'users' });
  });
});

describe('getCanonicalName - chained selective use', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table users { id int [pk] }',
    '/mid.dbml': "use { table users } from './base.dbml'",
    '/main.dbml': "use { table users } from './mid.dbml'",
  });

  test('resolves through intermediate', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'users')).toEqual({ schema: 'public', name: 'users' });
  });
});

describe('getCanonicalName - schema alias', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': 'Table auth.users { id int [pk] }\nTable auth.posts { id int [pk] }',
    '/main.dbml': "use { schema auth as a } from './base'",
  });

  test('table under aliased schema uses alias as schema name', () => {
    expect(getCanonicalName(compiler, '/main.dbml', 'users')).toEqual({ schema: 'a', name: 'users' });
    expect(getCanonicalName(compiler, '/main.dbml', 'posts')).toEqual({ schema: 'a', name: 'posts' });
  });
});
