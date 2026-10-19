import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/core/types/errors';
import type { Database } from '@/core/types/schemaJson';

const ARCH = '---\ndiagram_type: arch\n---\n';

function project (files: Record<string, string>, entry = '/main.dbml') {
  const layout = new MemoryProjectLayout();
  for (const [path, source] of Object.entries(files)) layout.setSource(Filepath.from(path), source);
  const compiler = new Compiler(layout);
  const file = Filepath.from(entry);
  const interpreted = compiler.interpretFile(file);
  return {
    compiler,
    errors: compiler.bindFile(file).getErrors(),
    interpreted,
    db: interpreted.getValue() as Database | undefined,
  };
}

describe('[example] architecture rules', () => {
  test('a link and a group cannot name a DBML table', () => {
    const schema = 'Table users {\n  id int [pk]\n}';
    const viaLink = project({ '/schema.dbml': schema, '/main.dbml': `${ARCH}use * from './schema'\nServer api\nLink: api > users` });
    expect(viaLink.errors.map((e) => [e.code, e.diagnostic])).toEqual([
      [CompileErrorCode.BINDING_ERROR, 'users is a table; a link joins elements'],
    ]);

    const viaGroup = project({ '/schema.dbml': schema, '/main.dbml': `${ARCH}use * from './schema'\nServer api\nGroup g { api users }` });
    expect(viaGroup.errors.map((e) => [e.code, e.diagnostic])).toEqual([
      [CompileErrorCode.BINDING_ERROR, 'users is a table; a group lists elements and groups'],
    ]);
  });

  test('a DBML file that imports nodes gets the built-in roles to draw them', () => {
    const { errors, db } = project({
      '/infra.dbml': `${ARCH}Server api`,
      '/main.dbml': "use * from './infra'\nTable users {\n  id int\n}",
    });
    expect(errors).toHaveLength(0);
    expect(db?.diagramType).toBeUndefined();
    expect(db?.nodes?.map((n) => n.kind)).toEqual(['Server']);
    expect(db?.kinds?.some((k) => k.name === 'Server' && k.builtin)).toBe(true);
  });

  test('a Kind declared in the importing file overrules the imported one', () => {
    const { errors, db } = project({
      '/pack.dbml': 'Kind Lakehouse [icon: graph]',
      '/main.dbml': `${ARCH}use * from './pack'\nKind Lakehouse [icon: database]\nLakehouse lake`,
    });
    expect(errors).toHaveLength(0);
    expect(db?.kinds?.filter((k) => k.name === 'Lakehouse').map((k) => k.icon)).toEqual(['database']);
    expect(db?.nodes?.[0].kind).toBe('Lakehouse');
  });

  test('the planned changes C3, C6, C7, C8, front matter in DBML and a.port hold', () => {
    const base = `${ARCH.replace('---\n', '---\ntitle: base\n')}Server api`;

    // C3: metadata from imported files applies in import order, a later import over an earlier one
    const metadata = (order: string[]) => project({
      '/base.dbml': base,
      '/a.dbml': `${ARCH}use * from './base'\nMetadata api {\n  tier: 'a'\n}`,
      '/b.dbml': `${ARCH}use * from './base'\nMetadata api {\n  tier: 'b'\n}`,
      '/main.dbml': `${ARCH}use * from './base'\n${order.map((f) => `use * from './${f}'`).join('\n')}`,
    }).db?.nodes?.[0].settings.tier;
    expect(metadata(['a', 'b'])).toBe('b');
    expect(metadata(['b', 'a'])).toBe('a');

    // C6 and C8: an imported file's front matter stays its own, and the file's own elements come first
    const own = project({ '/base.dbml': base, '/main.dbml': `${ARCH}use * from './base'\nServer web` });
    expect(own.db?.frontMatter).toEqual({ diagram_type: 'arch' });
    expect(own.db?.nodes?.map((n) => n.name)).toEqual(['web', 'api']);

    // C7: a file with an error reports no warnings
    const broken = project({ '/main.dbml': `${ARCH}Server a [type: 'postgress']\nLink: a > ghost` });
    expect(broken.interpreted.getErrors().map((e) => e.code)).toContain(CompileErrorCode.UNKNOWN_ENDPOINT);
    expect(broken.interpreted.getWarnings()).toHaveLength(0);

    // Front matter in a DBML file
    const dbml = project({ '/main.dbml': '---\ntitle: Schema\n---\nTable users {\n  id int\n}' });
    expect(dbml.compiler.fileKind(Filepath.from('/main.dbml'))).toBe('dbml');
    expect(dbml.errors).toHaveLength(0);
    expect(dbml.db?.frontMatter).toEqual({ title: 'Schema' });
    expect(dbml.db?.diagramType).toBeUndefined();

    // `a.web` is the endpoint `a`
    const port = project({ '/main.dbml': `${ARCH}Server a\nServer b\nLink: a.web > b` });
    expect(port.db?.links?.map((l) => [l.from, l.to])).toEqual([['a', 'b']]);
  });
});
