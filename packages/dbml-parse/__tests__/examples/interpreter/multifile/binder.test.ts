import { describe, expect, test } from 'vitest';
import { CompileErrorCode } from '@/core/types/errors';
import { fp, setupCompiler } from './utils';

describe('[example] multifile binder - TableGroup cannot reference imported table', () => {
  // base.dbml:   Table users { id int [pk] }
  //              Table posts { id int [pk] }
  // main.dbml:   use { table users } from './base.dbml'
  //              Table local { id int [pk] }
  //              TableGroup mixed { local; users }   <- users is imported -> error
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
}
`,
    '/main.dbml': `
use { table users } from './base.dbml'

Table local {
  id int [pk]
}

TableGroup mixed {
  local
  users
}
`,
  });

  const errors = compiler.bindNode(compiler.parseFile(fp('/main.dbml')).getValue().ast).getErrors();

  test('binding produces BINDING_ERROR for the imported table reference', () => {
    expect(errors.some((e) => e.code === CompileErrorCode.BINDING_ERROR)).toBe(true);
  });

  test('error message names the imported table', () => {
    const err = errors.find((e) => e.code === CompileErrorCode.BINDING_ERROR && e.message.includes('users'));
    expect(err).toBeDefined();
  });

  test('local table in the same tablegroup does not produce an error', () => {
    const localErr = errors.find((e) => e.code === CompileErrorCode.BINDING_ERROR && e.message.includes('local'));
    expect(localErr).toBeUndefined();
  });
});


describe('[example] multifile binder - TableGroup with all-imported tables emits one error per entry', () => {
  // base.dbml:   Table a { id int } / Table b { id int }
  // main.dbml:   use { table a } + use { table b } from './base.dbml'
  //              TableGroup all_imported { a; b }   <- both imported -> 2 errors
  const { compiler } = setupCompiler({
    '/base.dbml': `
Table a {
  id int
}
Table b {
  id int
}
`,
    '/main.dbml': `
use { table a } from './base.dbml'
use { table b } from './base.dbml'

TableGroup all_imported {
  a
  b
}
`,
  });

  test('binding produces one BINDING_ERROR per imported table reference', () => {
    const ast = compiler.parseFile(fp('/main.dbml')).getValue().ast;
    const errors = compiler.bindNode(ast).getErrors().filter((e) => e.code === CompileErrorCode.BINDING_ERROR);
    expect(errors).toHaveLength(2);
  });
});
