import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/core/types/errors';
import type { Database } from '@/core/types/schemaJson';

const ARCH = '---\ndiagram_type: arch\n---\n';
const MAIN = Filepath.from('/main.dbml');

function compilerFor (files: Record<string, string>): Compiler {
  const layout = new MemoryProjectLayout();
  for (const [path, source] of Object.entries(files)) layout.setSource(Filepath.from(path), source);
  return new Compiler(layout);
}

function compile (source: string, files: Record<string, string> = {}) {
  const compiler = compilerFor({ ...files, '/main.dbml': ARCH + source });
  const interpreted = compiler.interpretFile(MAIN);
  return {
    errors: compiler.bindFile(MAIN).getErrors().map((e) => [e.code, e.diagnostic]),
    warnings: interpreted.getWarnings().map((w) => w.code),
    db: interpreted.getValue() as Database | undefined,
  };
}

const linksOf = (db?: Database) => db?.links?.map((l) => [l.from, l.op, l.to]);

describe('[example] inline links', () => {
  test('a setting on an element is a link from that element, in each of the four directions', () => {
    const { errors, db } = compile('Server api [link: > db, link: < queue, ref: <> cache, link: - fw]\nDatabase db\nQueue queue\nCache cache\nFirewall fw');
    expect(errors).toEqual([]);
    expect(linksOf(db)).toEqual([
      ['api', '>', 'db'],
      ['api', '<', 'queue'],
      ['api', '<>', 'cache'],
      ['api', '-', 'fw'],
    ]);
  });

  test('the link is not kept as a setting, and other settings on the element stay', () => {
    const { db } = compile("Server api [color: '#ff0000', link: > db]\nDatabase db");
    expect(db?.nodes?.[0].settings).toEqual({ color: '#ff0000' });
  });

  test('a group and a note take inline links too, and a quoted name works as the target', () => {
    const { errors, db } = compile("Server a\nServer \"API 2\"\nGroup g [link: > \"API 2\"] { a }\nNote memo [link: - a] { 'x' }");
    expect(errors).toEqual([]);
    expect(linksOf(db)).toEqual([
      ['g', '>', 'API 2'],
      ['memo', '-', 'a'],
    ]);
  });

  test('a link with no target, with no operator, to nothing, or to a table is an error', () => {
    expect(compile('Server api [link]').errors).toEqual([
      [CompileErrorCode.EMPTY_LINK, 'An inline link needs an endpoint:  [link: > b]'],
    ]);
    expect(compile('Server api [link: db]\nDatabase db').errors).toEqual([
      [CompileErrorCode.BAD_LINK, 'An inline link reads  [link: > b],  [link: < b],  [link: <> b]  or  [link: - b]'],
    ]);
    expect(compile('Server api [link: > ghost]').errors).toEqual([
      [CompileErrorCode.UNKNOWN_ENDPOINT, 'ghost is not declared anywhere'],
    ]);
    expect(compile("use * from './schema'\nServer api [link: > users]", { '/schema.dbml': 'Table users {\n  id int\n}' }).errors).toEqual([
      [CompileErrorCode.BINDING_ERROR, 'users is a table; a link joins elements'],
    ]);
  });

  test('an inline link and a top-level Link between the same two elements warn as a duplicate', () => {
    const { warnings, db } = compile('Server api [link: > db]\nDatabase db\nLink: db < api');
    expect(warnings).toEqual([CompileErrorCode.DUPLICATE_LINK]);
    expect(db?.links).toHaveLength(2);
  });

  test('renaming an element without an alias renames it inside inline links', () => {
    const compiler = compilerFor({ '/main.dbml': `${ARCH}Server api [link: > db]\nDatabase db` });
    expect(compiler.renameElement(MAIN, 'db', 'main_db').get(MAIN.absolute))
      .toBe(`${ARCH}Server api [link: > Database main_db]\nDatabase main_db`);
  });

  test('a color on an inline link moves it out to a Link that can carry it, as an inline ref does', () => {
    const color = (source: string, value: string | null) => compilerFor({ '/main.dbml': `${ARCH}${source}` })
      .updateElementSetting(MAIN, { kind: 'Link', from: 'api', to: 'db' } as never, 'color', value);

    expect(color('Server api [link: > db]\nDatabase db', '#ff0000'))
      .toBe(`${ARCH}Server api\nDatabase db\n\nLink: Server api > Database db [color: #ff0000]\n`);
    expect(color('Server api [color: #00ff00, link: > db]\nDatabase db', '#ff0000'))
      .toBe(`${ARCH}Server api [color: #00ff00]\nDatabase db\n\nLink: Server api > Database db [color: #ff0000]\n`);
    expect(color('Server api [link: > db]\nDatabase db', null)).toBe(`${ARCH}Server api [link: > db]\nDatabase db`);
  });
});
