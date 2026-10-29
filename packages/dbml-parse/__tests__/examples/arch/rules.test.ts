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

  test('a DBML file that imports nodes gets them with their roles', () => {
    const { errors, db } = project({
      '/infra.dbml': `${ARCH}Server api`,
      '/main.dbml': "use * from './infra'\nTable users {\n  id int\n}",
    });
    expect(errors).toHaveLength(0);
    expect(db?.diagramType).toBeUndefined();
    expect(db?.nodes?.map((n) => n.role)).toEqual(['Server']);
  });

  test('a node carries its role in the declared spelling', () => {
    const { errors, db } = project({ '/main.dbml': `${ARCH}loadbalancer lb` });
    expect(errors).toHaveLength(0);
    expect(db?.nodes?.map((n) => n.role)).toEqual(['LoadBalancer']);
  });

  test('a Kind declaration is refused, since there are no custom roles', () => {
    const { compiler } = project({ '/main.dbml': `${ARCH}Kind Lakehouse [color: '#4a7c59']\nServer api` });
    expect(compiler.validateFile(Filepath.from('/main.dbml')).getErrors().map((e) => e.code)).toEqual([
      CompileErrorCode.NO_CUSTOM_ROLE,
    ]);
  });

  test('a word that is not a role is an error that names the nearest roles', () => {
    const { errors } = project({ '/main.dbml': `${ARCH}Sever api\nLakehouse lake` });
    expect(errors.map((e) => [e.code, e.diagnostic])).toEqual([
      [CompileErrorCode.UNKNOWN_ROLE, 'Sever is not a role. Did you mean: Server?'],
      [CompileErrorCode.UNKNOWN_ROLE, expect.stringMatching(/^Lakehouse is not a role\. /)],
    ]);
  });

  test('the planned changes C3, C6, C7, C8, front matter in DBML and a.port hold', () => {
    const base = `${ARCH.replace('---\n', '---\ntitle: base\n')}Server api`;

    const metadata = (order: string[]) => project({
      '/base.dbml': base,
      '/a.dbml': `${ARCH}use * from './base'\nMetadata api {\n  tier: 'a'\n}`,
      '/b.dbml': `${ARCH}use * from './base'\nMetadata api {\n  tier: 'b'\n}`,
      '/main.dbml': `${ARCH}use * from './base'\n${order.map((f) => `use * from './${f}'`).join('\n')}`,
    }).db?.nodes?.[0].settings.tier;
    expect(metadata(['a', 'b'])).toBe('b');
    expect(metadata(['b', 'a'])).toBe('a');

    const own = project({ '/base.dbml': base, '/main.dbml': `${ARCH}use * from './base'\nServer web` });
    expect(own.db?.frontMatter).toEqual({ diagram_type: 'arch' });
    expect(own.db?.nodes?.map((n) => n.name)).toEqual(['web', 'api']);

    const broken = project({ '/main.dbml': `${ARCH}Server a [type: 'postgress']\nLink: a > ghost` });
    expect(broken.interpreted.getErrors().map((e) => e.code)).toContain(CompileErrorCode.UNKNOWN_ENDPOINT);
    expect(broken.interpreted.getWarnings()).toHaveLength(0);

    const dbml = project({ '/main.dbml': '---\ntitle: Schema\n---\nTable users {\n  id int\n}' });
    expect(dbml.compiler.fileKind(Filepath.from('/main.dbml'))).toBe('dbml');
    expect(dbml.errors).toHaveLength(0);
    expect(dbml.db?.frontMatter).toEqual({ title: 'Schema' });
    expect(dbml.db?.diagramType).toBeUndefined();

    const port = project({ '/main.dbml': `${ARCH}Server a\nServer b\nLink: a.web > b` });
    expect(port.db?.links?.map((l) => [l.from, l.to])).toEqual([['a', 'b']]);
  });
});
