import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/index';
import { getDatabase, setupCompiler, fp } from './utils';

describe('[example] multifile interpreter - auto-imported metadata', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}
Metadata Table users {
  owner: 'scott'
}
`,
    '/main.dbml': `
use { table users } from './base.dbml'
`,
  });

  test('metadata travels with its targetwithout an explicit metadata import', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'scott' });
  });

  test('metadata is still attached in the file that declares it', () => {
    const db = getDatabase(compiler, '/base.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'scott' });
  });
});

describe('[example] multifile interpreter - duplicate metadata key across files', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}
Metadata Table users {
  color: #aaa
}
`,
    '/main.dbml': `
use { table users } from './base.dbml'
Metadata Table users {
  color: #f00
}
`,
  });

  test('metadata defined in current file overwrites metadata defined in imported file', () => {
    const result = compiler.interpretFile(fp('/main.dbml'));

    expect(result.getWarnings()).toHaveLength(0);
    expect(result.getErrors()).toHaveLength(0);

    const db = result.getValue()!;
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ color: '#f00' });
  });
});

describe('[example] multifile interpreter - metadata precedence across import graph', () => {
  // entry <- a <- c
  //       <- b
  test('dependency chain: entry <- a <- c, entry <- b; expected precedence: entry > b > a > c', () => {
    const { compiler } = setupCompiler({
      '/entry.dbml': `
use * from './a.dbml'
use * from './b.dbml'
Table users {
  id int [pk]
}
`,
      '/c.dbml': `
use { table users } from './entry.dbml'
Metadata Table users {
  owner: 'c'
  c: 'c'
  shared_a_c: 'c'
  shared_b_c: 'c'
}
`,
      '/a.dbml': `
use { table users } from './entry.dbml'
use * from './c.dbml'
Metadata Table users {
  owner: 'a'
  a: 'a'
  shared_a_c: 'a'
}
`,
      '/b.dbml': `
use { table users } from './entry.dbml'
Metadata Table users {
  owner: 'b'
  b: 'b'
  shared_b_c: 'b'
}
`,
    });

    const db = getDatabase(compiler, '/entry.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'b', a: 'a', b: 'b', shared_a_c: 'a', shared_b_c: 'b' });
  });

  // entry <- a
  //       <- b <- c
  test('dependency chain: entry <- a, entry <- b <- c; expected precedence: entry > b > c > a', () => {
    const { compiler } = setupCompiler({
      '/entry.dbml': `
use * from './a.dbml'
use * from './b.dbml'
Table users {
  id int [pk]
}
`,
      '/c.dbml': `
use { table users } from './entry.dbml'
Metadata Table users {
  owner: 'c'
  shared_a_c: 'c'
}
`,
      '/a.dbml': `
use { table users } from './entry.dbml'
Metadata Table users {
  owner: 'a'
  shared_a_c: 'a'
}
`,
      '/b.dbml': `
use { table users } from './entry.dbml'
use * from './c.dbml'
Metadata Table users {
  owner: 'b'
}
`,
    });

    const db = getDatabase(compiler, '/entry.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'b', shared_a_c: 'c' });
  });

  // entry <- a <- c
  //       <- b <-
  test('dependency chain: entry <- a <- c, entry <- b <- c; expected precedence: entry > b > a > c', () => {
    const { compiler } = setupCompiler({
      '/entry.dbml': `
Table users {
  id int [pk]
}
use * from './a.dbml'
use * from './b.dbml'
`,
      '/c.dbml': `
use { table users } from './entry.dbml'
Metadata Table users {
  owner: 'c'
  shared_a_c: 'c'
  shared_b_c: 'c'
}
`,
      '/a.dbml': `
use { table users } from './entry.dbml'
use * from './c.dbml'
Metadata Table users {
  owner: 'a'
  shared_a_b: 'a'
  shared_a_c: 'a'
}
`,
      '/b.dbml': `
use { table users } from './entry.dbml'
use * from './c.dbml'
Metadata Table users {
  owner: 'b'
  shared_a_b: 'b'
  shared_b_c: 'b'
}
`,
    });

    const db = getDatabase(compiler, '/entry.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'b', shared_a_b: 'b', shared_a_c: 'a', shared_b_c: 'b' });
  });

  // entry <- a <- b
  //       <------
  test('dependency chain: entry <- a <- b, entry <- b; expected precedence: entry > a > b', () => {
    const { compiler } = setupCompiler({
      '/entry.dbml': `
Table users {
  id int [pk]
}
use * from './a.dbml'
use * from './b.dbml'
`,
      '/a.dbml': `
use { table users } from './entry.dbml'
use * from './b.dbml'
Metadata Table users {
  owner: 'a'
}
`,
      '/b.dbml': `
use { table users } from './entry.dbml'
Metadata Table users {
  owner: 'b'
}
`,
    });

    const db = getDatabase(compiler, '/entry.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'a' });
  });
});

describe('[example] multifile interpreter - unreachable metadata are not attached', () => {
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}
`,
    '/extra.dbml': `
use { table users } from './base.dbml'
Metadata Table users {
  owner: 'extra'
}
`,
    '/main.dbml': `
use { table users } from './base.dbml'
`,
  });

  test('metadata declared in an unreachable file is excluded', () => {
    const db = getDatabase(compiler, '/main.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toEqual({});
  });

  test('the file declaring them still has metadata', () => {
    const db = getDatabase(compiler, '/extra.dbml');
    const users = db.tables.find((t) => t.name === 'users');
    expect(users?.metadata).toMatchObject({ owner: 'extra' });
  });
});
