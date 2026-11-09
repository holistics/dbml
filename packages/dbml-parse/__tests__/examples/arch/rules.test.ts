import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/core/types/errors';
import type { Database } from '@/core/types/schemaJson';

const ARCH = `---
diagram_type: arch
---
`;

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
    const schema = `Table users {
  id int [pk]
}`;
    const viaLink = project({ '/schema.dbml': schema, '/main.dbml': `${ARCH}use * from './schema'
Server api
Link: api > users` });
    expect(viaLink.errors.map((e) => [e.code, e.diagnostic])).toEqual([
      [CompileErrorCode.BINDING_ERROR, 'users is a table; a link joins elements'],
    ]);

    const viaGroup = project({ '/schema.dbml': schema, '/main.dbml': `${ARCH}use * from './schema'
Server api
Group g { api users }` });
    expect(viaGroup.errors.map((e) => [e.code, e.diagnostic])).toEqual([
      [CompileErrorCode.BINDING_ERROR, 'users is a table; a group lists elements and groups'],
    ]);
  });

  test('a DBML file that imports nodes gets them with their roles', () => {
    const { errors, db } = project({
      '/infra.dbml': `${ARCH}Server api`,
      '/main.dbml': `use * from './infra'
Table users {
  id int
}`,
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

  test('a word that is not a role is an error that names the nearest roles', () => {
    const { errors } = project({ '/main.dbml': `${ARCH}Sever api
Lakehouse lake` });
    expect(errors.map((e) => [e.code, e.diagnostic])).toEqual([
      [CompileErrorCode.ARCH_UNKNOWN_ROLE, 'Sever is not a role. Did you mean: Server?'],
      [CompileErrorCode.ARCH_UNKNOWN_ROLE, expect.stringMatching(/^Lakehouse is not a role\. /)],
    ]);
  });

  test('Metadata precedence follows import order, and imported nodes come after local ones', () => {
    const base = `${ARCH}Server api`;
    const metadata = (order: string[]) => project({
      '/base.dbml': base,
      '/a.dbml': `${ARCH}use * from './base'
Metadata api {
  tier: 'a'
}`,
      '/b.dbml': `${ARCH}use * from './base'
Metadata api {
  tier: 'b'
}`,
      '/main.dbml': `${ARCH}use * from './base'
${order.map((f) => `use * from './${f}'`).join('\n')}`,
    }).db?.nodes?.[0].metadata.tier?.value;
    expect(metadata(['a', 'b'])).toBe('b');
    expect(metadata(['b', 'a'])).toBe('a');

    const own = project({ '/base.dbml': base, '/main.dbml': `${ARCH}use * from './base'
Server web` });
    expect(own.db?.nodes?.map((n) => n.name)).toEqual(['web', 'api']);

    const broken = project({ '/main.dbml': `${ARCH}Server a [type: 'postgress']
Link: a > ghost` });
    expect(broken.interpreted.getErrors().map((e) => e.code)).toContain(CompileErrorCode.ARCH_UNKNOWN_ENDPOINT);
    expect(broken.interpreted.getWarnings()).toHaveLength(0);

    const dbml = project({ '/main.dbml': `Table users {
  id int
}` });
    expect(dbml.compiler.fileKind(Filepath.from('/main.dbml'))).toBe('dbml');
    expect(dbml.errors).toHaveLength(0);
    expect(dbml.db?.diagramType).toBeUndefined();
  });

  test('link settings go before the colon or after the second end, not both', () => {
    const before = project({ '/main.dbml': `${ARCH}Server a
Server b
Link [color: #ff0000]: a > b` });
    expect(before.errors).toEqual([]);
    expect(before.db?.links?.[0].settings).toEqual({ color: '#ff0000' });
    const both = project({ '/main.dbml': `${ARCH}Server a
Server b
Link [color: #ff0000]: a > b [proto: 'https']` });
    expect(both.errors.map((e) => e.diagnostic)).toEqual(['Write the link settings in one place: before the colon or after the second end']);
  });

  test('stacked is a group flag, written bare, as true or false, or in a Metadata block', () => {
    const getSettings = (source: string) => project({ '/main.dbml': `${ARCH}Server a
${source}` }).db?.groups?.[0].settings;
    expect(getSettings('Group g [stacked] { a }')).toEqual({ stacked: true });
    expect(getSettings('Group g [stacked: false] { a }')).toEqual({ stacked: false });
    expect(getSettings(`Group g {
  a
  stacked: true
}`)).toEqual({ stacked: true });
    expect(getSettings(`Group g { a }
Metadata Group g { stacked: true }`)).toEqual({ stacked: true });

    const wrong = project({ '/main.dbml': `${ARCH}Server a
Group g [stacked: 3] { a }` });
    const messages = [...wrong.errors, ...wrong.interpreted.getErrors()].map((e) => e.diagnostic);
    expect(messages).toContain("'stacked' must be true or false");
  });

  test('label is top or bottom on a group, in any case, quoted or not', () => {
    const getSettings = (source: string) => project({ '/main.dbml': `${ARCH}Server a
${source}` }).db?.groups?.[0].settings;
    expect(getSettings('Group g [label: top] { a }')).toEqual({ label: 'top' });
    expect(getSettings('Group g [label: Bottom] { a }')).toEqual({ label: 'bottom' });
    expect(getSettings("Group g [label: 'top'] { a }")).toEqual({ label: 'top' });

    const wrong = project({ '/main.dbml': `${ARCH}Server a
Group g [label: left] { a }` });
    const messages = [...wrong.errors, ...wrong.interpreted.getErrors()].map((e) => e.diagnostic);
    expect(messages).toContain("'label' can only be top or bottom");
  });

  test('stacked is not a setting on an element', () => {
    const { db } = project({ '/main.dbml': `${ARCH}Server a [stacked: true]` });
    expect(db?.nodes?.[0].settings).toEqual({});
    expect(db?.nodes?.[0].metadata.stacked?.value).toBe(true);
  });

  test('a link end, an inline link end and a group member written a.b is an error', () => {
    for (const source of [`Server a
Server b
Link: a.web > b`, `Server b
Server a [link: > b.web]`, `Server a
Group g {
  a.web
}`]) {
      const result = project({ '/main.dbml': `${ARCH}${source}` });
      expect(result.errors.map((e) => e.diagnostic)[0]).toMatch(/`a\.b` is not a name/);
    }
  });
});
