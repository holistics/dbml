import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { Filepath } from '@/core/types/filepath';
import { ARCH_BUILTIN_ROLES } from '@/core/arch/vocabulary';
import { EXAMPLE_ENTRY, EXAMPLE_FILES, INLINE_FILE } from './samples';
import {
  compileArch, isArchitecture, isGroup, isNode,
} from './compileArch';
import type { NetworkModel } from './compileArch';

// The original architecture compiler's tests, run through @dbml/parse

const ARCH = '---\ndiagram_type: arch\n---\n';
const one = (src: string) => compileArch({ '/main.arch.dbml': ARCH + src });
const codes = (src: string) => one(src).diagnostics.map((d) => d.code);

describe('the architecture dialect on DBML\'s grammar', () => {
  it('reads a bodyless declaration, which DBML itself has no use for', () => {
    const { model, diagnostics } = one('Database mongo1');
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('mongo1')?.sort).toBe('node');
  });

  it('draws the declared name, and takes the alias as the handle', () => {
    const { model, diagnostics } = compileArch(
      { '/d': '---\ndiagram_type: arch\n---\n\nServer "dbdiagram API1" as api1\nServer api2' },
      '/d',
    );
    expect(diagnostics).toEqual([]);

    expect(model.elements.get('api1')).toMatchObject({ id: 'api1', alias: 'api1', label: 'dbdiagram API1' });
    expect(model.elements.get('api2')).toMatchObject({ id: 'api2', alias: null, label: 'api2' });
  });

  it('lets two boxes share a caption when their handles differ', () => {
    const { model, diagnostics } = compileArch({
      '/d': [
        '---',
        'diagram_type: arch',
        '---',
        '',
        'Internet "Internet" as net_dbdiagram',
        'Internet "Internet" as net_dbdocs',
        'Link: net_dbdiagram > net_dbdocs',
      ].join('\n'),
    }, '/d');

    expect(diagnostics).toEqual([]);
    expect([...model.elements.values()].map((e) => e.label)).toEqual(['Internet', 'Internet']);
    expect(model.links[0]).toMatchObject({ from: 'net_dbdiagram', to: 'net_dbdocs' });
  });

  it('still refuses two handles that are the same', () => {
    const { diagnostics } = compileArch(
      { '/d': '---\ndiagram_type: arch\n---\n\nServer "A" as x\nServer "B" as x' },
      '/d',
    );
    expect(diagnostics.map((d) => d.code)).toEqual(['duplicate-name']);
  });

  it('resolves a link, a member and a metadata target through either spelling', () => {
    const { model, diagnostics } = compileArch({
      '/d': [
        '---',
        'diagram_type: arch',
        '---',
        '',
        'Server "dbdiagram API1" as api1',
        'Database "Main" as pg',
        'Group "API servers" as api { api1 }',
        'Link: api1 > pg',
        'Metadata pg {',
        "  owner: 'platform-team'",
        '}',
      ].join('\n'),
    }, '/d');

    expect(diagnostics).toEqual([]);
    expect(model.elements.get('api1')?.parent).toBe('api');
    expect(model.links[0]).toMatchObject({ from: 'api1', to: 'pg' });
    expect(model.elements.get('pg')?.metadata).toMatchObject({ owner: 'platform-team' });
  });

  it('puts the protocol and the host on the line, where they describe something', () => {
    const { model } = one("Server a\nServer b\nLink: a > b [proto: HTTPS, host: 'api.dbdiagram.com']");
    expect(model.links[0].settings).toEqual({ proto: 'HTTPS', host: 'api.dbdiagram.com' });
  });

  it('nests a group inside a group with no new syntax', () => {
    const { model } = one('Database a\nDatabase b\nGroup inner { a  b }\nGroup outer { inner }');
    expect(model.elements.get('a')?.parent).toBe('inner');
    expect(model.elements.get('inner')?.parent).toBe('outer');
    expect(model.roots).toEqual(['outer']);
  });

  it('lets a link end on a container rather than on one of its members', () => {
    const { model, diagnostics } = one('Server api1\nDatabase m1\nGroup rs { m1 }\nLink: api1 > rs');
    expect(diagnostics).toEqual([]);
    expect(model.links[0]).toMatchObject({ from: 'api1', to: 'rs', op: '>' });
  });

  it('keeps the operator, because the operator is the direction', () => {
    const { model } = one('Server a\nServer b\nLink: a - b\nLink: a <> b');
    expect(model.links.map((l) => l.op)).toEqual(['-', '<>']);
  });

  it('reads an inline note out of a body', () => {
    const { model, diagnostics } = one("Server a {\n  Note: 'the only thing a body carries now'\n}");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('a')?.note).toBe('the only thing a body carries now');
  });

  it('closes the vocabulary against any word that is not a role', () => {
    // With no diagram_type the file is DBML, so DBML's parser reports it
    const schema = compileArch({ '/d.dbml': 'Microservice x' }, '/d.dbml');
    expect(schema.diagnostics.map((d) => d.code).every((code) => code.startsWith('parse-'))).toBe(true);
    expect(codes('Microservice x')).toEqual(['unknown-role']);
  });

  it('refuses a Kind, since there are no custom roles', () => {
    const { diagnostics } = one("Kind Microservice [color: '#29b5e8']\nServer x");
    expect(diagnostics.map((d) => d.code)).toEqual(['no-custom-role']);
    expect(diagnostics[0].message).toContain('built-in role');
  });

  it('warns rather than fails on an opinion', () => {
    expect(codes('Server a\nServer b\nLink: a > b\nLink: b > a')).toEqual(['duplicate-link']);
    expect(codes('Server a\nGroup g { a }\nLink: a > g')).toEqual(['nested-endpoints']);
  });

  it('errors on a line to something that was never declared', () => {
    expect(codes('Server a\nLink: a > ghost')).toEqual(['unknown-endpoint']);
  });

  it('gives every diagnostic a real line and column', () => {
    const { diagnostics } = one('Server a\nMicroservice x');
    expect(diagnostics[0]).toMatchObject({ line: 5, column: 1, file: '/main.arch.dbml' });
  });
});

describe('the worked example', () => {
  it('compiles across files, following use with no modules registered', () => {
    const { model, diagnostics } = compileArch(EXAMPLE_FILES, EXAMPLE_ENTRY);
    expect(diagnostics).toEqual([]);
    expect(model.files).toContain('/packs/devops.arch.dbml');
    // the monitoring elements came from the imported file, and a group here lists them
    expect(isNode(model.elements.get('grafana')) && model.elements.get('grafana'))
      .toMatchObject({ role: 'Monitoring', type: 'grafana', parent: 'monitoring' });
    expect(isNode(model.elements.get('mongo1')) && model.elements.get('mongo1'))
      .toMatchObject({ role: 'Database', type: 'mongodb' });
    expect(model.elements.get('mongo1')?.parent).toBe('mongo_rs');
    expect(model.elements.get('mongo_rs')?.parent).toBe('production');
    expect(model.elements.get('production')?.parent).toBe('private_net');
  });

  it('attaches metadata declared outside the thing it describes', () => {
    const { model } = compileArch(EXAMPLE_FILES, EXAMPLE_ENTRY);
    expect(model.elements.get('api1')?.metadata).toMatchObject({ owner: 'platform-team' });
  });

  it('produces a model that is complete enough to draw', () => {
    const { model } = compileArch(EXAMPLE_FILES, EXAMPLE_ENTRY);
    for (const link of model.links) {
      expect(model.elements.has(link.from), link.id).toBe(true);
      expect(model.elements.has(link.to), link.id).toBe(true);
    }
    for (const element of model.elements.values()) {
      if (element.parent) expect(model.elements.has(element.parent), element.id).toBe(true);
    }
  });
});

describe('what decides the dialect', () => {
  it('never reads the file name, which is what makes a cloud document work', () => {
    const source = `${ARCH}Database m1 [type: 'mongodb']\nServer a\nLink: a > m1`;
    const named = compileArch({ '/infra.arch.dbml': source }, '/infra.arch.dbml');
    const plain = compileArch({ '/untitled.dbml': source }, '/untitled.dbml');
    // dbdiagram's cloud documents have no path at all, so a name can never be the signal
    const blob = compileArch({ '/d': source }, '/d');
    for (const result of [named, plain, blob]) {
      expect(result.diagnostics).toEqual([]);
      expect(result.model.elements.size).toBe(2);
      expect(result.model.links.length).toBe(1);
    }
  });

  it('reads diagram_type off front matter, and needs it', () => {
    const marked = compileArch({ '/d.dbml': '---\ndiagram_type: arch\n---\n\nServer a' }, '/d.dbml');
    expect(marked.diagramType).toBe('arch');
    expect(marked.diagnostics).toEqual([]);

    const bare = compileArch({ '/d.dbml': 'Server a' }, '/d.dbml');
    expect(bare.diagramType).toBeNull();
    expect(isArchitecture(bare)).toBe(false);
    expect(bare.diagnostics.length).toBeGreaterThan(0);

    const schema = compileArch({ '/d.dbml': '---\ndiagram_type: dbml\n---\nServer a' }, '/d.dbml');
    expect(schema.diagramType).toBe('dbml');
    expect(isArchitecture(schema)).toBe(false);
  });

  it('refuses diagram_type inside Project, pointing to front matter', () => {
    const r = compileArch({ '/d.dbml': `${ARCH}Project x {\n  diagram_type: 'arch'\n}\nServer a` }, '/d.dbml');
    expect(r.diagnostics.map((d) => d.code)).toEqual(['diagram-type-not-here']);
  });

  it('ignores a diagram_type that is not in front matter', () => {
    const nested = compileArch({ '/d.dbml': "Table t {\n  diagram_type varchar [note: 'arch']\n}\nServer a" }, '/d.dbml');
    expect(nested.diagramType).toBeNull();
    expect(isArchitecture(nested)).toBe(false);
    const commented = compileArch({ '/d.dbml': '// ---\n// diagram_type: arch\n// ---\nServer a' }, '/d.dbml');
    expect(commented.diagramType).toBeNull();
    expect(isArchitecture(commented)).toBe(false);
  });

  it('accepts the long spelling, in any case, quoted or not', () => {
    for (const spelling of ['arch', 'architecture', 'Arch', 'ARCHITECTURE', "'arch'"]) {
      const r = compileArch({ '/d.dbml': `---\ndiagram_type: ${spelling}\n---\n\nServer a` }, '/d.dbml');
      expect(isArchitecture(r), spelling).toBe(true);
      expect(r.diagnostics, spelling).toEqual([]);
    }
  });

  it('answers for a document that has drawn nothing yet', () => {
    // with nothing drawn, only diagram_type says "architecture"; it exists so a canvas does not
    // flicker while somebody is still typing
    const { model, diagramType } = compileArch(
      { '/d.dbml': '---\ndiagram_type: arch\n---\n' },
      '/d.dbml',
    );
    expect(model.elements.size).toBe(0);
    expect(diagramType).toBe('arch');
  });

  it('keeps Project out of the drawing', () => {
    const { model } = compileArch({ '/d.dbml': '---\ndiagram_type: arch\n---\nServer a' }, '/d.dbml');
    expect([...model.elements.keys()]).toEqual(['a']);
  });
});

describe('the naming convention', () => {
  it('resolves a .arch.dbml file through the stock dbml resolver', () => {
    const { model, diagnostics } = compileArch({
      '/main.arch.dbml': `${ARCH}use * from './packs/devops.arch'\nGroup g { m1 }`,
      '/packs/devops.arch.dbml': `${ARCH}Database m1`,
    }, '/main.arch.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('m1')?.parent).toBe('g');
  });
});

describe('the inline sample', () => {
  it('compiles as one document, with no imports and no filename to read', () => {
    const { model, diagnostics, diagramType } = compileArch({ '/d': INLINE_FILE }, '/d');
    expect(diagnostics).toEqual([]);
    expect(diagramType).toBe('arch');
    expect(model.files).toEqual(['/d']);
    expect(model.elements.size).toBeGreaterThan(20);
    expect(model.links.length).toBeGreaterThan(14);
  });

  it('gives every node a built-in role', () => {
    const { model } = compileArch({ '/d': INLINE_FILE }, '/d');
    for (const node of [...model.elements.values()].filter(isNode)) {
      expect(ARCH_BUILTIN_ROLES[node.role], `${node.id} -> ${node.role}`).toBeDefined();
    }
  });
});

describe('a note written as markdown', () => {
  const SOURCE = [
    '---',
    'diagram_type: arch',
    '---',
    'Server "Lexer" as lex {',
    "  Note: '''",
    '  **642 lines, and not one DBML word in them.**',
    '',
    '  - `allowFrontMatter` is the one switch',
    '    - nested under it',
    "  '''",
    '}',
    'Server parse',
    'Group "@dbml/parse" as pkg {',
    '  lex',
    '  parse',
    "  Note: '''",
    '  **The front end**',
    '',
    '  - `lexer.ts`',
    '  - `parser.ts`',
    "  '''",
    '}',
  ].join('\n');

  it('hangs a markdown listing off a container, line breaks intact', () => {
    const { model, diagnostics } = compileArch({ '/d': SOURCE }, '/d');
    expect(diagnostics).toEqual([]);
    const group = model.elements.get('pkg');
    expect(group?.note?.split('\n').length).toBeGreaterThan(2);
    expect(group?.note).toContain('- `lexer.ts`');
    expect([...model.elements.values()].filter((e) => e.sort === 'note')).toEqual([]);
  });

  it('takes the same note on a node, with no change to the syntax', () => {
    const { model } = compileArch({ '/d': SOURCE }, '/d');
    const lexer = model.elements.get('lex');
    expect(lexer?.sort).toBe('node');
    expect(lexer?.note).toContain('642 lines');
    expect(lexer?.note).toContain('- `allowFrontMatter`');
  });

  it('strips the indentation the author used, so the markdown starts at column one', () => {
    const { model } = compileArch({ '/d': SOURCE }, '/d');
    const note = model.elements.get('lex')?.note ?? '';
    expect(note.startsWith('**')).toBe(true);
    expect(note).toContain('\n  - nested under it');
  });
});

describe('deciding whether to show an architecture canvas', () => {
  const asks = (src: string) => isArchitecture(compileArch({ '/d.dbml': src }, '/d.dbml'));

  it('says no to a DBML schema, which is what keeps the tab off a public page', () => {
    expect(asks('Table users {\n  id int [pk]\n}')).toBe(false);
    expect(asks('Enum status { draft\n published }')).toBe(false);
    expect(asks('')).toBe(false);
  });

  it('says no to a document with nothing drawn on it, unless the author said otherwise', () => {
    expect(asks('Project p { }')).toBe(false);
    expect(asks('---\ndiagram_type: arch\n---\n')).toBe(true);
  });

  it('says no to notes alone, which a half-written file collects by accident', () => {
    expect(asks("Note n { 'just thinking' }")).toBe(false);
  });

  it('says yes only with the marker, whatever is drawn', () => {
    expect(asks('Server api1')).toBe(false);
    expect(asks(`${ARCH}Server api1`)).toBe(true);
    expect(asks(`${ARCH}loadbalancer lb`)).toBe(true);
  });

  it('says yes to the sample, which is the one a reader will actually open', () => {
    expect(isArchitecture(compileArch({ '/d': INLINE_FILE }, '/d'))).toBe(true);
  });
});

describe('reading one document out of a project', () => {
  it('leaves a DBML schema sitting beside it alone', () => {
    const { model, diagnostics } = compileArch({
      '/main.dbml': 'Table users {\n  id int [pk]\n}\nEnum status { draft }',
      '/infra.arch.dbml': `${ARCH}Server api1\nDatabase db1\nLink: api1 > db1`,
    }, '/infra.arch.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.files).toEqual(['/infra.arch.dbml']);
    expect(model.elements.size).toBe(2);
  });

  it('still follows what the entry point imports', () => {
    const { model, diagnostics } = compileArch({
      '/main.dbml': 'Table users {\n  id int [pk]\n}',
      '/infra.arch.dbml': `${ARCH}use * from './packs/devops.arch'\nGroup g { m1 }`,
      '/packs/devops.arch.dbml': `${ARCH}Database m1`,
    }, '/infra.arch.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.files).toContain('/packs/devops.arch.dbml');
    expect(model.files).not.toContain('/main.dbml');
  });
});

describe('Project', () => {
  const PROJECT = `---
diagram_type: arch
direction: down
---

Project dbx {
  database_type: 'PostgreSQL'
  title: 'DBX network diagram'
  Note: 'The DBX production estate'
}

Server api1
Database db1
Link: api1 > db1
`;

  it('keeps every row, as a schema Project does', () => {
    const { model, diagnostics } = compileArch({ '/d.dbml': PROJECT }, '/d.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.project).toMatchObject({
      name: 'dbx',
      database_type: 'PostgreSQL',
      title: 'DBX network diagram',
      note: { value: 'The DBX production estate' },
    });
  });

  it('takes no name, and the INLINE_FILE sample reads its rows', () => {
    expect(compileArch({ '/d.dbml': `${ARCH}Project {\n  title: 'x'\n}\nServer a` }, '/d.dbml').diagnostics).toEqual([]);
    const { model, diagramType, diagnostics } = compileArch({ '/d': INLINE_FILE }, '/d');
    expect(diagnostics).toEqual([]);
    expect(model.project).toMatchObject({ title: 'DBX network diagram', owner: 'platform-team' });
    expect(diagramType).toBe('arch');
  });

  it('follows the schema rules: no alias, no settings, string values, no tables', () => {
    const messages = (source: string) => compileArch({ '/d.dbml': `${source}\nServer a` }, '/d.dbml').diagnostics.map((d) => d.message);
    expect(messages('Project p as q {\n}')).toContain("A Project shouldn't have an alias");
    expect(messages("Project p [note: 'x'] {\n}")).toContain("A Project shouldn't have a setting list");
    expect(messages('Project p {\n  owner: 3\n}').length).toBeGreaterThan(0);
  });
});

describe('front matter', () => {
  it('keeps every key', () => {
    const { model, diagnostics } = compileArch({ '/d.dbml': '---\ndiagram_type: arch\ndirection: down\ntitle: x\n---\nServer a' }, '/d.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.frontMatter).toEqual({ diagram_type: 'arch', direction: 'down', title: 'x' });
  });

  it('counts only at the very top of the file', () => {
    const { diagnostics } = compileArch({ '/d.dbml': 'Server a\n---\ndiagram_type: arch\n---\n' }, '/d.dbml');
    expect(diagnostics.length).toBeGreaterThan(0);
  });
});

describe('DBML is untouched by any of this', () => {
  const SCHEMA = `Table users {
  id int [pk]
  username varchar [not null]
  email varchar [unique, not null]
}

Table posts {
  id int [pk]
  title varchar [not null]
  user_id int [ref: > users.id]

  indexes {
    (user_id, id)
  }
}

Enum post_status {
  draft
  published
}

Metadata Table users {
  owner: 'data-team'
}
`;

  it('still compiles as DBML, with the stock compiler and no switches', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(Filepath.from('/main.dbml'), SCHEMA);
    const compiler = new Compiler(layout);
    const report = compiler.interpretFile(Filepath.from('/main.dbml'));
    expect(report.getErrors()).toEqual([]);
    const db = report.getValue() as { tables?: unknown[]; enums?: unknown[] } | undefined;
    expect(db?.tables).toHaveLength(2);
    expect(db?.enums).toHaveLength(1);
  });

  it('is not an architecture document, so the canvas never offers itself', () => {
    expect(isArchitecture(compileArch({ '/main.dbml': SCHEMA }, '/main.dbml'))).toBe(false);
  });

  it('keeps its own diagnostics when something is actually wrong with it', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(Filepath.from('/main.dbml'), 'Table users {\n  id int [ref: > ghost.id]\n}');
    const compiler = new Compiler(layout);
    expect(compiler.interpretFile(Filepath.from('/main.dbml')).getErrors().length).toBeGreaterThan(0);
  });

  it('still refuses a bodyless Table, because that switch is off for DBML', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(Filepath.from('/main.dbml'), 'Table users');
    const compiler = new Compiler(layout);
    expect(compiler.parseFile(Filepath.from('/main.dbml')).getErrors().length).toBeGreaterThan(0);
  });
});

describe('a brand is a setting, not a keyword', () => {
  const draw = (line: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${line}` },
    '/d',
  );

  it('keeps the role and the brand as two separate facts', () => {
    const { model, diagnostics } = draw("Proxy \"ha 1\" as lb1 {\n  type: 'haproxy'\n}");
    expect(diagnostics).toEqual([]);

    const lb = model.elements.get('lb1');
    expect(isNode(lb) && lb).toMatchObject({ role: 'Proxy', type: 'haproxy', label: 'ha 1' });
  });

  it('can still be asked which boxes are databases, whatever vendor they run', () => {
    const { model } = draw([
      "Database users_db [type: 'postgres']",
      "Database events [type: 'mongodb']",
      "Cache sessions [type: 'redis']",
      "Proxy lb [type: 'haproxy']",
    ].join('\n'));

    const databases = [...model.elements.values()].filter(isNode).filter((n) => n.role === 'Database');
    expect(databases.map((n) => n.id)).toEqual(['users_db', 'events']);
    expect(databases.map((n) => n.type)).toEqual(['postgres', 'mongodb']);
  });

  it('resolves the spellings people type through the pack aliases', () => {
    for (const [typed, resolved] of [['pg', 'postgres'],
      ['postgresql', 'postgres'],
      ['mongo', 'mongodb'],
      ['k8s', 'kubernetes'],
      ['elasticsearch', 'elastic']]) {
      const { model, diagnostics } = draw(`Database d [type: '${typed}']`);
      expect(diagnostics, typed).toEqual([]);
      expect(isNode(model.elements.get('d')) && model.elements.get('d')).toMatchObject({ type: resolved });
    }
  });

  it('draws a devops estate out of roles, with no vocabulary at all', () => {
    const { model, diagnostics } = draw([
      "CDN        edge     [type: 'cloudflare']",
      "Proxy      lb       [type: 'haproxy']",
      "Container  api      [type: 'docker']",
      "Database   main     [type: 'postgres']",
      "Cache      sessions [type: 'redis']",
      "Monitoring metrics  [type: 'prometheus']",
      'Link: edge > lb',
      'Link: lb > api',
      'Link: api > main',
    ].join('\n'));

    expect(diagnostics).toEqual([]);
    expect([...model.elements.values()].filter(isNode).map((n) => n.type))
      .toEqual(['cloudflare', 'haproxy', 'docker', 'postgres', 'redis', 'prometheus']);
  });

  it('tells a brand used as a keyword which setting it belongs in', () => {
    const { diagnostics } = draw('Postgres users_db');
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-role']);
    expect(diagnostics[0].message).toContain("Database name [type: 'postgres']");
  });

  it('still suggests the near role for a word that is neither', () => {
    expect(draw('Databse d').diagnostics[0].message).toBe('Databse is not a role. Did you mean: Database?');
    // with nothing near, it lists the roles rather than inviting a custom one
    expect(draw('Zarf z').diagnostics[0].message).toContain('The roles are: Server, Function');
  });

  it('warns on a type nobody can draw, and keeps the box', () => {
    const { model, diagnostics } = draw("Database d [type: 'postgress']");
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-type']);
    expect(diagnostics[0].message).toContain('postgres');
    expect(isNode(model.elements.get('d')) && model.elements.get('d')).toMatchObject({ type: null });
  });

  it('takes no URL: a picture goes in icon', () => {
    for (const value of ['https://example.com/acme.svg', 'javascript:alert(1)']) {
      const { model, diagnostics } = draw(`Database d [type: '${value}']`);
      expect(diagnostics.map((d) => d.code), value).toEqual(['unknown-type']);
      expect(isNode(model.elements.get('d')) && model.elements.get('d')).toMatchObject({ type: null, icon: null });
    }
  });

  it('has 32 roles and no brands among them', () => {
    expect(Object.keys(ARCH_BUILTIN_ROLES)).toHaveLength(32);
    for (const brand of ['Postgres', 'Mongo', 'Redis', 'HAProxy', 'Docker', 'Kubernetes']) {
      expect(ARCH_BUILTIN_ROLES[brand], brand).toBeUndefined();
    }
  });
});

describe('icon', () => {
  const draw = (body: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${body}` },
    '/d',
  );
  const pictureOf = (model: NetworkModel, id: string): string | null => {
    const element = model.elements.get(id);
    return isNode(element) ? element.icon : null;
  };

  it('takes a data URI as readily as a URL', () => {
    const { diagnostics, model } = draw("Database d [icon: 'data:image/png;base64,iVBORw0KGgo=']");
    expect(diagnostics).toEqual([]);
    expect(pictureOf(model, 'd')).toContain('data:image/png');
  });

  // The string becomes an image source in somebody else's page. The author of a diagram is not
  // always the person opening it.
  it('ignores a value that is not an https or data:image URL', () => {
    for (const bad of ['javascript:alert(1)',
      'http://example.com/a.png',
      'file:///etc/passwd',
      'data:text/html,<script>']) {
      const { model, diagnostics } = draw(`Database d [icon: '${bad}']`);
      expect(pictureOf(model, 'd'), bad).toBe(null);
      expect(diagnostics, bad).toEqual([]);
    }
  });

  it('a Metadata block can set it, and it wins over the node', () => {
    const { model, diagnostics } = draw("Database d [icon: 'https://a.example/a.png']\nMetadata d {\n  icon: 'https://b.example/b.png'\n}");
    expect(diagnostics).toEqual([]);
    expect(pictureOf(model, 'd')).toBe('https://b.example/b.png');
  });

  it('image and glyph are custom properties, and a group has no icon setting', () => {
    const { model, diagnostics } = draw("Server s [image: 'https://example.com/a.svg', glyph: 'M12 3v18']\nGroup g [icon: 'lock'] { s }");
    expect(diagnostics).toEqual([]);
    expect(pictureOf(model, 's')).toBe(null);
    expect(model.elements.get('s')?.metadata).toEqual({ image: 'https://example.com/a.svg', glyph: 'M12 3v18' });
    expect(model.elements.get('g')?.metadata).toEqual({ icon: 'lock' });
  });
});

describe('a role word is case-insensitive, because Table is', () => {
  const draw = (line: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n${line}` },
    '/d',
  );

  it('takes any casing of a built-in word', () => {
    for (const spelling of ['Database', 'database', 'DATABASE', 'DataBase']) {
      expect(draw(`${spelling} a`).diagnostics, spelling).toEqual([]);
    }
    for (const spelling of ['LoadBalancer', 'loadbalancer', 'LOADBALANCER']) {
      expect(draw(`${spelling} a`).diagnostics, spelling).toEqual([]);
    }
    for (const spelling of ['Cache', 'cache', 'CACHE']) {
      expect(draw(`${spelling} a`).diagnostics, spelling).toEqual([]);
    }
  });

  // The author's casing is not kept: everything downstream (the renderer's icon, a tooltip, a
  // host reading the model) looks a role up by name, and two spellings would be two roles.
  it('records the canonical spelling, whatever was typed', () => {
    const { model } = draw('loadbalancer a');
    expect(isNode(model.elements.get('a')) && model.elements.get('a')).toMatchObject({ role: 'LoadBalancer' });
  });

  it('has no two built-in words differing only in case, which would make the table ambiguous', () => {
    const lowered = Object.keys(ARCH_BUILTIN_ROLES).map((name) => name.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });
});

describe('custom properties take the values DBML takes', () => {
  const read = (line: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\nDatabase d [${line}]` },
    '/d',
  );
  const metadataOf = (line: string): Record<string, unknown> => {
    const { model, diagnostics } = read(line);
    expect(diagnostics).toEqual([]);
    return model.elements.get('d')?.metadata ?? {};
  };

  it('keeps a quoted value a string, however numeric it looks', () => {
    expect(metadataOf("engine_version: '16.30'")).toEqual({ engine_version: '16.30' });
    expect(metadataOf("account: '0123456789'")).toEqual({ account: '0123456789' });
  });

  it('reads a number, a boolean and a color literal', () => {
    expect(metadataOf('allocated_storage: 100, ratio: 0.5, multi_az: true, brand: #336791'))
      .toEqual({ allocated_storage: 100, ratio: 0.5, multi_az: true, brand: '#336791' });
  });

  it('refuses a bare word and a bare flag, in the words DBML uses', () => {
    for (const line of ['provider: aws', 'multi_az']) {
      const { diagnostics } = read(line);
      expect(diagnostics.map((d) => d.message), line)
        .toEqual([`Custom setting '${line.split(':')[0]}' must be a string, a color literal, a number literal, or a boolean literal`]);
    }
  });

  it('carries custom properties through to the model, wherever they are written', () => {
    const { model, diagnostics } = compileArch({
      '/d': [
        '---',
        'diagram_type: arch',
        '---',
        '',
        "Database pg [type: 'postgres', region: 'ap-southeast-1', instance_class: 'db.t3.medium']",
        "Server api [type: 'docker']",
        'Link: api > pg [proto: TCP, port: 5432]',
        "Group vpc [name: 'Production', cidr: '10.0.0.0/16'] { api pg }",
        'Metadata pg {',
        "  tf_module: 'modules/rds'",
        '}',
      ].join('\n'),
    }, '/d');

    expect(diagnostics).toEqual([]);
    expect(model.elements.get('pg')?.settings).toEqual({ type: 'postgres' });
    expect(model.elements.get('pg')?.metadata).toEqual({
      region: 'ap-southeast-1', instance_class: 'db.t3.medium', tf_module: 'modules/rds',
    });
    expect(model.links[0].settings).toMatchObject({ proto: 'TCP', port: 5432 });
    expect(model.elements.get('vpc')?.metadata).toMatchObject({ name: 'Production', cidr: '10.0.0.0/16' });
  });
});

describe('metadata follows DBML', () => {
  const draw = (src: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${src}` },
    '/d',
  );

  it("takes `key: 'value'`, which is what the DBML docs show", () => {
    const { model, diagnostics } = draw("Server api\nMetadata api {\n  owner: 'scott'\n}");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('api')?.metadata).toMatchObject({ owner: 'scott' });
  });

  // The parser only accepts a bare identifier in the slot the short form reads from, so a name
  // with a dash needs this form.
  it('takes the kind-qualified target, which is the only form that accepts a quoted name', () => {
    const { model, diagnostics } = draw([
      "Database \"dbdocs-dev\" [type: 'postgres']",
      'Metadata Database "dbdocs-dev" {',
      "  owner: 'platform-team'",
      '}',
    ].join('\n'));

    expect(diagnostics).toEqual([]);
    expect(model.elements.get('dbdocs-dev')?.metadata).toMatchObject({ owner: 'platform-team' });
  });

  it('names nothing when the stated role is not what that thing is', () => {
    const { diagnostics } = draw("Server api\nMetadata Database api {\n  owner: 'x'\n}");
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-metadata-target']);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].message).toBe('Database api is not declared anywhere');
  });

  it('refuses what DBML refuses, in the words DBML uses', () => {
    for (const body of ['oncall', "owner 'scott'"]) {
      const { diagnostics } = draw(`Server api\nMetadata api {\n  ${body}\n}`);
      expect(diagnostics.map((d) => d.code), body).toEqual(['bad-property']);
      expect(diagnostics[0].message, body).toBe("A Metadata field must use the 'key: value' syntax");
    }

    const dup = draw("Server api\nMetadata api {\n  a: '1'\n  a: '2'\n}");
    expect(dup.diagnostics.map((d) => d.code)).toEqual(['duplicate-property']);
    expect(dup.diagnostics[0].message).toBe('Duplicate Metadata fields are defined');
  });

  // Precedence, as in DBML: inline lowest, then `Metadata` from imported files, then `Metadata` here
  it('layers a block over the inline settings, later and louder', () => {
    const { model, diagnostics } = draw([
      "Server api [type: 'docker', tier: 'two']",
      'Metadata api {',
      "  tier: 'one'",
      "  owner: 'platform-team'",
      '}',
    ].join('\n'));

    expect(diagnostics).toEqual([]);
    expect(model.elements.get('api')?.settings).toEqual({ type: 'docker' });
    expect(model.elements.get('api')?.metadata).toEqual({ tier: 'one', owner: 'platform-team' });
  });

  it('changes a setting when the key is one, in any case, and checks its value', () => {
    const { model, diagnostics } = draw("Server api [color: #111111]\nMetadata api {\n  Color: #222222\n  STYLE: dashed\n  Note: 'from metadata'\n}");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('api')?.settings).toEqual({ color: '#222222', style: 'dashed' });
    expect(model.elements.get('api')?.note).toBe('from metadata');
    expect(draw("Server api\nMetadata api {\n  color: 'red'\n}").diagnostics.map((d) => d.message)).toEqual(["'color' must be a color literal"]);
    expect(draw('Server api\nMetadata api {\n  owner: platform\n}').diagnostics.map((d) => d.message))
      .toEqual(['A Metadata field value must be a string, a color literal, a number literal, or a boolean literal']);
  });

  it('lets a later file outrank an earlier one, as DBML documents', () => {
    const { model, diagnostics } = compileArch({
      '/main.arch.dbml': [
        '---',
        'diagram_type: arch',
        '---',
        '',
        "use * from './ops.arch'",
        'Server api',
      ].join('\n'),
      // a file of only Metadata blocks needs its own diagram_type, and imports what it annotates
      '/ops.arch.dbml': "---\ndiagram_type: arch\n---\nuse { Server api } from './main.arch'\nMetadata api {\n  owner: 'ops-team'\n}",
    }, '/main.arch.dbml');

    expect(diagnostics).toEqual([]);
    expect(model.elements.get('api')?.metadata).toMatchObject({ owner: 'ops-team' });
  });
});

describe('the body carries the properties', () => {
  const draw = (src: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${src}` },
    '/d',
  );

  it('reads key: value lines on an element', () => {
    const { model, diagnostics } = draw([
      "Database users_db [type: 'postgres'] {",
      "  version: '16.3'",
      '  port: 5432',
      "  owner: 'platform-team'",
      '}',
    ].join('\n'));

    expect(diagnostics).toEqual([]);
    expect(model.elements.get('users_db')?.settings).toEqual({ type: 'postgres' });
    expect(model.elements.get('users_db')?.metadata).toEqual({ version: '16.3', port: 5432, owner: 'platform-team' });
  });

  it('reads them on a container too, beside its members', () => {
    const { model, diagnostics } = draw([
      'Server a',
      'Server b',
      'Group g [color: #336791] {',
      '  a',
      '  b',
      "  owner: 'platform-team'",
      '}',
    ].join('\n'));

    expect(diagnostics).toEqual([]);
    const group = model.elements.get('g');
    expect(group?.settings).toEqual({ color: '#336791' });
    expect(group?.metadata).toEqual({ owner: 'platform-team' });
    expect(isGroup(group) && group.children).toEqual(['a', 'b']);
  });

  it('leaves Note where it was, rather than treating it as a property', () => {
    const { model, diagnostics } = draw("Database d {\n  version: '16.3'\n  Note: 'the main one'\n}");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('d')?.note).toBe('the main one');
    expect(model.elements.get('d')?.metadata).toEqual({ version: '16.3' });
  });

  it('takes the note from [note: ...], and the body Note wins', () => {
    expect(draw("Database d [note: 'from brackets']").model.elements.get('d')?.note).toBe('from brackets');
    expect(draw("Database d [note: 'from brackets'] {\n  Note: 'from the body'\n}").model.elements.get('d')?.note).toBe('from the body');
    expect(draw('Group g [note: 3] { }').diagnostics.map((d) => d.message)).toEqual(["'note' must be a string literal"]);
  });

  it('lets the body win a collision, being the more specific place to have said it', () => {
    const { model } = draw("Database d [type: 'postgres', color: #111111, tier: 'two'] {\n  tier: 'one'\n  color: #222222\n}");
    expect(model.elements.get('d')?.settings).toEqual({ type: 'postgres', color: '#222222' });
    expect(model.elements.get('d')?.metadata).toEqual({ tier: 'one' });
  });

  it('reads setting names in any case, in [ ] and in the body', () => {
    const { model, diagnostics } = draw("Database d [TYPE: 'postgres'] {\n  Color: #336791\n  Style: dashed\n}");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('d')?.settings).toEqual({ type: 'postgres', color: '#336791', style: 'dashed' });
    expect(isNode(model.elements.get('d')) && model.elements.get('d')).toMatchObject({ type: 'postgres' });
  });

  it('refuses a key set twice in one body, in any case', () => {
    expect(draw("Database d {\n  a: '1'\n  A: '2'\n}").diagnostics.map((x) => x.code)).toEqual(['duplicate-property']);
  });

  it('a color is a color literal, on a node, a group and a link', () => {
    const messages = (src: string) => draw(src).diagnostics.map((d) => d.message);
    expect(messages("Server a [color: '#336791']")).toEqual(["'color' must be a color literal"]);
    expect(messages("Group g {\n  color: 'red'\n}")).toEqual(["'color' must be a color literal"]);
    expect(messages("Server a\nServer b\nLink: a > b [color: 'red']")).toEqual(["'color' must be a color literal"]);
  });

  it('style takes only dashed', () => {
    expect(draw('Server a [style: dotted]').diagnostics.map((d) => d.message)).toEqual(["'style' can only be dashed"]);
  });
});

describe('flags in a body', () => {
  const draw = (src: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${src}` },
    '/d',
  );

  it('reads inactive as true, alone or with other words on the line', () => {
    const { model, diagnostics } = draw("Database d {\n  type: 'postgres'\n  inactive\n}");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('d')?.settings).toEqual({ type: 'postgres', inactive: true });
  });

  it('refuses a bare word that is not a setting, as DBML refuses a custom flag', () => {
    expect(draw('Database d { ssl }').diagnostics.map((d) => d.message))
      .toEqual(["Custom setting 'ssl' must be a string, a color literal, a number literal, or a boolean literal"]);
  });

  it('refuses the same flag twice', () => {
    expect(draw('Database d {\n  inactive\n  inactive\n}').diagnostics.map((x) => x.code))
      .toEqual(['duplicate-property']);
  });

  it('still reads a container body as member names, never as flags', () => {
    const { model, diagnostics } = draw('Server a\nServer b\nGroup g { a b }');
    const group = model.elements.get('g');
    expect(diagnostics).toEqual([]);
    expect(group?.settings).toEqual({});
    expect(isGroup(group) && group.children).toEqual(['a', 'b']);
  });

  it('lets a container carry both, since a property has a colon and a member does not', () => {
    const { model, diagnostics } = draw("Server a\nGroup g {\n  a\n  owner: 'platform-team'\n}");
    const group = model.elements.get('g');
    expect(diagnostics).toEqual([]);
    expect(group?.metadata).toEqual({ owner: 'platform-team' });
    expect(isGroup(group) && group.children).toEqual(['a']);
  });

  it('a member that is not declared is an error', () => {
    expect(draw('Server a\nGroup g { a ghost }').diagnostics.map((d) => [d.code, d.message]))
      .toEqual([['unknown-member', 'ghost is not declared anywhere']]);
  });
});
