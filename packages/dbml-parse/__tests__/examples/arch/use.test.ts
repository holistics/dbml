import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/core/types/errors';
import type { Database } from '@/core/types/schemaJson';

const ARCH = '---\ndiagram_type: arch\n---\n';

function compile (x: string, main: string) {
  const layout = new MemoryProjectLayout();
  layout.setSource(Filepath.from('/x.dbml'), x);
  layout.setSource(Filepath.from('/main.dbml'), ARCH + main);
  const compiler = new Compiler(layout);
  const entry = Filepath.from('/main.dbml');
  return {
    errors: compiler.bindFile(entry).getErrors(),
    db: compiler.interpretFile(entry).getValue() as Database | undefined,
  };
}

describe('[example] selective imports in an architecture file', () => {
  test('a word that is not what the element is, is an error', () => {
    const { errors } = compile('Server api', "use { Database api } from './x'");
    expect(errors.map((e) => [e.code, e.diagnostic])).toEqual([
      [CompileErrorCode.BINDING_ERROR, 'api is a Server, not a Database'],
    ]);
  });

  test('the right word imports the element', () => {
    const { errors, db } = compile('Server api', "use { Server api } from './x'");
    expect(errors).toHaveLength(0);
    expect(db?.nodes?.map((n) => n.name)).toEqual(['api']);
  });

  test('Group imports a group', () => {
    const { errors, db } = compile('Server api\nGroup g { api }', "use { Group g } from './x'");
    expect(errors).toHaveLength(0);
    expect(db?.groups?.map((g) => g.name)).toEqual(['g']);
  });

  test('Kind imports nothing and is refused, since there are no custom roles', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(Filepath.from('/x.dbml'), 'Server api');
    layout.setSource(Filepath.from('/main.dbml'), `${ARCH}use { Kind Lakehouse } from './x'`);
    const compiler = new Compiler(layout);
    const entry = Filepath.from('/main.dbml');
    expect(compiler.validateFile(entry).getErrors().map((e) => e.code)).toEqual([
      CompileErrorCode.NO_CUSTOM_ROLE,
    ]);
    expect(compiler.bindFile(entry).getErrors().filter((e) => e.code !== CompileErrorCode.NO_CUSTOM_ROLE)).toHaveLength(0);
  });

  test('a role word on a group is an error', () => {
    const { errors } = compile('Server api\nGroup g { api }', "use { Server g } from './x'");
    expect(errors.map((e) => e.diagnostic)).toEqual(['g is a Group, not a Server']);
  });
});
