import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { ARCH_BUILTIN_ROLES, ARCH_NAME_PRECEDENCE } from '@/core/arch/vocabulary';
import { fullName } from '@/compiler/queries/transform/utils/arch';
import { Filepath } from '@/core/types/filepath';
import { SymbolKind } from '@/core/types/symbol';
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
    errors: [
      ...compiler.parseFile(MAIN).getErrors(),
      ...compiler.bindFile(MAIN).getErrors(),
    ].map((e) => e.diagnostic),
    warnings: interpreted.getWarnings().map((w) => w.diagnostic),
    db: interpreted.getValue() as Database | undefined,
  };
}

const linksOf = (db?: Database) => db?.links?.map((l) => [`${l.fromRole} ${l.from}`, l.op, `${l.toRole} ${l.to}`]);
const childrenOf = (db: Database | undefined, group: string) => db?.groups?.find((g) => (g.alias ?? g.name) === group)?.children
  .map((c) => `${c.role} ${c.handle}`);

function edit (source: string, change: (compiler: Compiler) => Map<string, string>): string | undefined {
  return change(compilerFor({ '/main.dbml': ARCH + source })).get(MAIN.absolute)?.slice(ARCH.length);
}

describe('[example] a name can repeat across roles', () => {
  test('a Server, a Group and a Note may share a name', () => {
    const { errors, db } = compile("Server api\nGroup api { }\nNote api { 'x' }");
    expect(errors).toEqual([]);
    expect(db?.nodes?.map((n) => n.name)).toEqual(['api']);
    expect(db?.groups?.map((g) => g.name)).toEqual(['api']);
    expect(db?.notes.map((n) => n.name)).toEqual(['api']);
  });

  test('the same role and name twice is an error, imports included', () => {
    expect(compile('Server api\nServer api').errors).toEqual(['api is already declared']);
    expect(compile("use { Server api } from './x'\nServer api", { '/x.dbml': `${ARCH}Server api` }).errors)
      .toEqual(['api is already declared']);
  });

  test('an alias is unique among every name, whatever the role', () => {
    expect(compile('Server "API" as api\nGroup api { }').errors).toEqual(['api is already declared']);
    expect(compile('Group api { }\nServer "API" as api').errors).toEqual(['api is already declared']);
    expect(compile('Server a as x\nDatabase b as x').errors).toEqual(['x is already declared']);
  });

  test('a label is not an identifier, so an alias may repeat it', () => {
    expect(compile('Server "api" as api').errors).toEqual([]);
    expect(compile('Server "api" as web\nGroup api { }').errors).toEqual([]);
  });
});

describe('[example] a role picks the element', () => {
  const SHARED = 'Server client\nServer api\nGroup api { }\n';

  test('in a link, an inline link, a group member on its own line and Metadata', () => {
    const { errors, warnings, db } = compile(`${SHARED}Link: client > Group api\nDatabase db [link: > Group api]\nGroup g {\n  Group api\n}\nMetadata Group api {\n  owner: 'x'\n}`);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(linksOf(db)).toEqual([['Server client', '>', 'Group api'], ['Database db', '>', 'Group api']]);
    expect(childrenOf(db, 'g')).toEqual(['Group api']);
    expect(db?.groups?.find((g) => g.name === 'api')?.metadata.owner?.value).toBe('x');
  });

  test('a role on both ends of a link', () => {
    const { errors, db } = compile(`${SHARED}Link: Group api > Server api`);
    expect(errors).toEqual([]);
    expect(linksOf(db)).toEqual([['Group api', '>', 'Server api']]);
  });

  test('a role no element with that name has is not declared', () => {
    expect(compile(`${SHARED}Link: client > Database api`).errors).toEqual(['Database api is not declared anywhere']);
    expect(compile("Server api\nMetadata Database api {\n  owner: 'x'\n}").errors).toEqual(['Database api is not declared anywhere']);
  });

  test('a quoted name takes a role too, and Metadata names it without one', () => {
    const { errors, db } = compile('Server b\nServer "API 1"\nLink: b > Server "API 1"\nMetadata "API 1" {\n  owner: \'x\'\n}');
    expect(errors).toEqual([]);
    expect(linksOf(db)).toEqual([['Server b', '>', 'Server API 1']]);
    expect(db?.nodes?.find((n) => n.name === 'API 1')?.metadata.owner?.value).toBe('x');
  });
});

describe('[example] without a role, NAME_PRECEDENCE picks', () => {
  test('NAME_PRECEDENCE is the 39 roles in order, then Group, then Note', () => {
    expect(ARCH_NAME_PRECEDENCE).toHaveLength(41);
    expect(ARCH_NAME_PRECEDENCE).toEqual([...Object.keys(ARCH_BUILTIN_ROLES), 'Group', 'Note']);
  });

  test('a link goes to the Server before the Group, with no warning', () => {
    const { errors, warnings, db } = compile('Server client\nServer api\nGroup api { }\nLink: client > api');
    expect(errors).toEqual([]);
    expect(linksOf(db)).toEqual([['Server client', '>', 'Server api']]);
    expect(warnings).toEqual([]);
  });

  test('a Group before a Note, and three candidates, with no warning', () => {
    const { warnings, db } = compile("Group api { }\nNote api { 'x' }\nDatabase api\nServer c [link: > api]");
    expect(linksOf(db)).toEqual([['Server c', '>', 'Database api']]);
    expect(warnings).toEqual([]);
  });

  test('Metadata without a role follows the same order, with no warning', () => {
    const { warnings, db } = compile("Server api\nGroup api { }\nMetadata api {\n  owner: 'x'\n}");
    expect(db?.nodes?.[0].metadata.owner?.value).toBe('x');
    expect(db?.groups?.[0].metadata).not.toHaveProperty('owner');
    expect(warnings).toEqual([]);
  });

  test('a name only one element has gives no warning', () => {
    expect(compile('Server client\nServer api\nLink: client > api').warnings).toEqual([]);
  });
});

describe('[example] group members', () => {
  test('on the line of `{` every word is a name, never a role', () => {
    const { errors, db } = compile('Server api\nServer web\nGroup g { api web }');
    expect(errors).toEqual([]);
    expect(childrenOf(db, 'g')).toEqual(['Server api', 'Server web']);
  });

  test('on a line of its own, one member: a name, or a role and a name', () => {
    const { errors, db } = compile('Server api\nGroup api { }\nDatabase db\nGroup g {\n  Group api\n  db\n}');
    expect(errors).toEqual([]);
    expect(childrenOf(db, 'g')).toEqual(['Group api', 'Database db']);
  });

  test('two names, or three words, on a line of their own is an error', () => {
    const message = 'A member line holds one member: a name, or a role and a name (Server api)';
    expect(compile('Server api\nServer db\nGroup g {\n  api db\n}').errors).toEqual([message]);
    expect(compile('Server api\nGroup g {\n  Server api x\n}').errors).toEqual([message]);
  });
});

describe('[example] an imported alias', () => {
  const X = { '/x.dbml': `${ARCH}Server "API Gateway" as api` };

  test('only the alias names it here, and the box keeps the name its file gave it', () => {
    const { errors, db } = compile("use { Server api as api2 } from './x'\nServer client\nLink: client > api2", X);
    expect(errors).toEqual([]);
    expect(db?.nodes?.find((n) => n.alias === 'api2')?.name).toBe('API Gateway');
    expect(linksOf(db)).toEqual([['Server client', '>', 'Server api2']]);
    expect(compile("use { Server api as api2 } from './x'\nServer client\nLink: client > api", X).errors)
      .toEqual(['api is not declared anywhere']);
  });

  test('a local element with the original name is a different element', () => {
    const { errors, db } = compile("use { Server api as api2 } from './x'\nServer api\nLink: api > api2\nGroup g { api api2 }", X);
    expect(errors).toEqual([]);
    expect(linksOf(db)).toEqual([['Server api', '>', 'Server api2']]);
    expect(childrenOf(db, 'g')).toEqual(['Server api', 'Server api2']);
  });
});

describe('[example] rename and remove go by role and name', () => {
  const SOURCE = 'Server api\nGroup api { }\nServer c\nLink: c > Server api\nLink: c > Group api\nGroup g {\n  Group api\n}';

  test('renaming one leaves the references to the other alone', () => {
    expect(edit(SOURCE, (c) => c.renameElement(MAIN, 'api', 'grp', 'Group')))
      .toBe('Server api\nGroup grp { }\nServer c\nLink: c > Server api\nLink: c > Group grp\nGroup g {\n  Group grp\n}');
  });

  test('a bare name that would come to mean the other element gets its role written', () => {
    expect(edit('Server x\nGroup api { }\nServer c\nLink: c > api\nGroup g { c api }', (c) => c.renameElement(MAIN, 'x', 'api', 'Server')))
      .toBe('Server api\nGroup api { }\nServer c\nLink: c > Group api\nGroup g { c\n  Group api\n}');
  });

  test('renaming to a name only another role has is allowed; the same role is refused', () => {
    expect(edit('Server a\nGroup b { }', (c) => c.renameElement(MAIN, 'a', 'b'))).toBe('Server b\nGroup b { }');
    expect(compilerFor({ '/main.dbml': `${ARCH}Server a\nServer b` }).renameElement(MAIN, 'a', 'b').size).toBe(0);
  });

  test('removing one keeps the other and what names it', () => {
    expect(edit(SOURCE, (c) => c.removeElement(MAIN, 'api', 'Group')))
      .toBe('Server api\nServer c\nLink: c > Server api\nGroup g {\n}');
  });

  test('a setting goes on the element with that role', () => {
    const compiler = compilerFor({ '/main.dbml': `${ARCH}Server api\nGroup api { }` });
    expect(compiler.updateElementSetting(MAIN, { kind: SymbolKind.Element, name: 'api', role: 'Group' } as never, 'color', "'#ff0000'"))
      .toBe(`${ARCH}Server api\nGroup api [color: '#ff0000'] { }`);
  });

  test('the app writes a reference as its full name, role and handle, quoted when needed', () => {
    expect(fullName('api', 'Server')).toBe('Server api');
    expect(fullName('API 1', 'Server')).toBe('Server "API 1"');
    expect(fullName('memo', 'Note')).toBe('Note memo');
  });

  test('moving an inline link out writes both ends by full name, with no warning', () => {
    const compiler = compilerFor({ '/main.dbml': `${ARCH}Server api\nGroup api { }\nServer c [link: > api]` });
    const out = compiler.updateElementSetting(MAIN, {
      kind: 'Link', from: 'c', to: 'api', fromRole: 'Server', toRole: 'Server',
    } as never, 'color', "'#f00'");
    expect(out).toBe(`${ARCH}Server api\nGroup api { }\nServer c\n\nLink: Server c > Server api [color: '#f00']\n`);
    expect(compile(out.slice(ARCH.length)).warnings).toEqual([]);
  });
});
