import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { Filepath } from '@/core/types/filepath';
import { BUILTIN_ROLES } from '@/core/arch/vocabulary';
import { EXAMPLE_ENTRY, EXAMPLE_FILES, INLINE_FILE } from './samples';
import {
  compileArch, isArchitecture, isGroup, isNode,
} from './compileArch';
import type { NetworkModel } from './compileArch';

// The original architecture compiler's tests, run through @dbml/parse

const one = (src: string) => compileArch({ '/main.arch.dbml': src });
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
    expect(model.elements.get('pg')?.settings).toMatchObject({ owner: 'platform-team' });
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
    // With no diagram_type and no role word the file is DBML, so DBML's parser reports it
    expect(codes('Microservice x').every((code) => code.startsWith('parse-'))).toBe(true);
    expect(codes('---\ndiagram_type: arch\n---\nMicroservice x')).toEqual(['unknown-role']);
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
    expect(diagnostics[0]).toMatchObject({ line: 2, column: 1, file: '/main.arch.dbml' });
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
    expect(model.elements.get('api1')?.settings).toMatchObject({ owner: 'platform-team' });
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
    const source = "Database m1 [type: 'mongodb']\nServer a\nLink: a > m1";
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

  it('reads diagram_type off front matter, and treats it as advice', () => {
    const marked = compileArch({ '/d.dbml': '---\ndiagram_type: arch\n---\n\nServer a' }, '/d.dbml');
    expect(marked.diagramType).toBe('arch');
    expect(marked.diagnostics).toEqual([]);

    const bare = compileArch({ '/d.dbml': 'Server a' }, '/d.dbml');
    expect(bare.diagramType).toBeNull();
    expect(bare.model.elements.size).toBe(marked.model.elements.size);
  });

  it('refuses to honour it inside Project, because a host cannot reach it there', () => {
    const misplaced = compileArch(
      { '/d.dbml': "Project x {\n  diagram_type: 'arch'\n}\nServer a" },
      '/d.dbml',
    );
    expect(misplaced.diagramType).toBeNull();
    expect(misplaced.diagnostics.map((d) => d.code)).toEqual(['diagram-type-not-here']);
    expect(misplaced.diagnostics[0].severity).toBe('error');
    expect(misplaced.diagnostics[0].message).toContain('diagram_type: arch');
    // A file with an error gives no model, as a DBML file does
    expect(isArchitecture(misplaced)).toBe(false);
  });

  it('answers from front matter even when a Project block argues with it', () => {
    const both = compileArch(
      { '/d.dbml': "---\ndiagram_type: arch\n---\n\nProject x {\n  diagram_type: 'database'\n}\nServer a" },
      '/d.dbml',
    );
    expect(both.diagramType).toBe('arch');
    expect(both.diagnostics.map((d) => d.code)).toEqual(['diagram-type-not-here']);
  });

  it('accepts the long spelling, so nobody has to remember two words', () => {
    for (const spelling of ['arch', 'architecture', 'Arch', 'ARCHITECTURE']) {
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
      '/main.arch.dbml': "use * from './packs/devops.arch'\nGroup g { m1 }",
      '/packs/devops.arch.dbml': 'Database m1',
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
      expect(BUILTIN_ROLES[node.role], `${node.id} -> ${node.role}`).toBeDefined();
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
    '  lex parse',
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

  it('says yes once something is drawn, with no marker and no filename', () => {
    expect(asks('Server api1')).toBe(true);
    expect(asks('loadbalancer lb')).toBe(true);
  });

  it('says yes to the sample, which is the one a reader will actually open', () => {
    expect(isArchitecture(compileArch({ '/d': INLINE_FILE }, '/d'))).toBe(true);
  });
});

describe('reading one document out of a project', () => {
  it('leaves a DBML schema sitting beside it alone', () => {
    const { model, diagnostics } = compileArch({
      '/main.dbml': 'Table users {\n  id int [pk]\n}\nEnum status { draft }',
      '/infra.arch.dbml': 'Server api1\nDatabase db1\nLink: api1 > db1',
    }, '/infra.arch.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.files).toEqual(['/infra.arch.dbml']);
    expect(model.elements.size).toBe(2);
  });

  it('still follows what the entry point imports', () => {
    const { model, diagnostics } = compileArch({
      '/main.dbml': 'Table users {\n  id int [pk]\n}',
      '/infra.arch.dbml': "use * from './packs/devops.arch'\nGroup g { m1 }",
      '/packs/devops.arch.dbml': 'Database m1',
    }, '/infra.arch.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.files).toContain('/packs/devops.arch.dbml');
    expect(model.files).not.toContain('/main.dbml');
  });
});

describe('front matter', () => {
  const FM = `---
title: DBX network diagram
owner: platform-team
updated: 2026-10-12
---

Server api1 [name: 'dbdiagram API1']
Database db1
Link: api1 > db1
`;

  it('reads a --- block the way Markdown does', () => {
    const { model, diagnostics } = compileArch({ '/d.dbml': FM }, '/d.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.frontMatter).toEqual({
      title: 'DBX network diagram',
      owner: 'platform-team',
      updated: '2026-10-12',
    });
  });

  it('does not move the lines after it, which is the only hard part', () => {
    const { diagnostics } = compileArch({ '/d.dbml': '---\ntitle: x\n---\nMicroservice bad' }, '/d.dbml');
    // no diagram_type and no known kind word, so DBML's parser reports it; still on line 4, not line 1
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every((d) => d.line === 4)).toBe(true);
  });

  it('leaves a document alone when the fence is never closed', () => {
    const { model, diagnostics } = compileArch({ '/d.dbml': '---\ntitle: x\nServer a' }, '/d.dbml');
    expect(model.frontMatter).toEqual({});
    expect(diagnostics.length).toBeGreaterThan(0); // it is text, and text is not a declaration
  });
});

describe('the example carries both kinds of metadata', () => {
  it('reads the --- block and the Project block from the same document', () => {
    const { model, diagramType, diagnostics } = compileArch({ '/d': INLINE_FILE }, '/d');
    expect(diagnostics).toEqual([]);
    expect(model.frontMatter.title).toBe('DBX network diagram');
    expect(model.frontMatter.owner).toBe('platform-team');
    expect(diagramType).toBe('arch');
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

  it('takes a URL in the same slot, for a brand the pack has never drawn', () => {
    const { model, diagnostics } = draw("Database d [type: 'https://example.com/acme.svg']");
    expect(diagnostics).toEqual([]);
    expect(isNode(model.elements.get('d')) && model.elements.get('d'))
      .toMatchObject({ type: null, image: 'https://example.com/acme.svg' });
  });

  it('refuses a scheme that would execute, in that slot too', () => {
    const { diagnostics } = draw("Database d [type: 'javascript:alert(1)']");
    expect(diagnostics.map((d) => d.code)).toEqual(['bad-image']);
  });

  it('has 31 roles and no brands among them', () => {
    expect(Object.keys(BUILTIN_ROLES)).toHaveLength(31);
    for (const brand of ['Postgres', 'Mongo', 'Redis', 'HAProxy', 'Docker', 'Kubernetes']) {
      expect(BUILTIN_ROLES[brand], brand).toBeUndefined();
    }
  });
});

describe('a picture, in the slot that already names the mark', () => {
  const draw = (body: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${body}` },
    '/d',
  );
  const pictureOf = (model: NetworkModel, id: string): string | null => {
    const element = model.elements.get(id);
    return isNode(element) ? element.image : null;
  };

  it('takes a data URI as readily as a URL', () => {
    const { diagnostics, model } = draw("Database d [type: 'data:image/png;base64,iVBORw0KGgo=']");
    expect(diagnostics).toEqual([]);
    expect(pictureOf(model, 'd')).toContain('data:image/png');
  });

  // The string becomes an `href` inside an SVG in somebody else's page, and a `javascript:` href
  // there executes. The author of a diagram is not always the person opening it.
  it('refuses a scheme that would execute, or break on a TLS page', () => {
    for (const bad of ['javascript:alert(1)',
      'http://example.com/a.png',
      'file:///etc/passwd',
      'data:text/html,<script>']) {
      const onType = draw(`Database d [type: '${bad}']`);
      expect(pictureOf(onType.model, 'd'), bad).toBe(null);
      expect(onType.diagnostics.map((d) => d.code), bad).toEqual(['bad-image']);
    }
  });

  it('has no image setting at all, which is the point', () => {
    const { model, diagnostics } = draw("Database d [image: 'https://example.com/a.svg']");
    expect(diagnostics).toEqual([]);
    expect(pictureOf(model, 'd')).toBe(null);
    // it survives as a free-form property, the way any unknown setting does
    expect(model.elements.get('d')?.settings.image).toBe('https://example.com/a.svg');
  });

  it('keeps icon and glyph as ordinary properties, since a role carries the mark', () => {
    const { model, diagnostics } = draw("Server s [icon: chip, glyph: 'M12 3v18']\nGroup g [icon: lock] { s }");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('s')?.settings).toMatchObject({ icon: 'chip', glyph: 'M12 3v18' });
    expect(model.elements.get('g')?.settings).toMatchObject({ icon: 'lock' });
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
    const lowered = Object.keys(BUILTIN_ROLES).map((name) => name.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });
});

describe('quotes mean what they say', () => {
  const settingsOf = (line: string): Record<string, unknown> => {
    const { model, diagnostics } = compileArch(
      { '/d': `---\ndiagram_type: arch\n---\n\nDatabase d [${line}]` },
      '/d',
    );
    expect(diagnostics).toEqual([]);
    return model.elements.get('d')?.settings ?? {};
  };

  it('keeps a quoted value a string, however numeric it looks', () => {
    expect(settingsOf("engine_version: '16.3'")).toEqual({ engine_version: '16.3' });
    expect(settingsOf("engine_version: '16.30'")).toEqual({ engine_version: '16.30' });
    expect(settingsOf("zone: '01'")).toEqual({ zone: '01' });
    expect(settingsOf("account: '0123456789'")).toEqual({ account: '0123456789' });
  });

  it('still reads a bare number as a number', () => {
    expect(settingsOf('allocated_storage: 100')).toEqual({ allocated_storage: 100 });
    expect(settingsOf('ratio: 0.5')).toEqual({ ratio: 0.5 });
  });

  it('keeps a bare word a word, and a bare flag true', () => {
    expect(settingsOf('provider: aws')).toEqual({ provider: 'aws' });
    expect(settingsOf('multi_az')).toEqual({ multi_az: true });
  });

  it('carries free-form settings through to the model, wherever they are written', () => {
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
    expect(model.elements.get('pg')?.settings).toMatchObject({
      region: 'ap-southeast-1', instance_class: 'db.t3.medium',
    });
    expect(model.links[0].settings).toMatchObject({ proto: 'TCP', port: 5432 });
    expect(model.elements.get('vpc')?.settings).toMatchObject({ cidr: '10.0.0.0/16' });
    expect(model.elements.get('pg')?.settings).toMatchObject({ tf_module: 'modules/rds' });
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
    expect(model.elements.get('api')?.settings).toMatchObject({ owner: 'scott' });
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
    expect(model.elements.get('dbdocs-dev')?.settings).toMatchObject({ owner: 'platform-team' });
  });

  it('says so when the stated role is not what that thing is', () => {
    const { diagnostics } = draw("Server api\nMetadata Database api {\n  owner: 'x'\n}");
    expect(diagnostics.map((d) => d.code)).toEqual(['metadata-role-mismatch']);
    expect(diagnostics[0].severity).toBe('warning');
    expect(diagnostics[0].message).toContain('Server');
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
    expect(model.elements.get('api')?.settings).toMatchObject({
      type: 'docker',
      tier: 'one',
      owner: 'platform-team',
    });
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
    expect(model.elements.get('api')?.settings).toMatchObject({ owner: 'ops-team' });
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
    expect(model.elements.get('users_db')?.settings).toEqual({
      type: 'postgres', version: '16.3', port: 5432, owner: 'platform-team',
    });
  });

  it('reads them on a container too, beside its members', () => {
    const { model, diagnostics } = draw([
      'Server a',
      'Server b',
      "Group g [name: 'G'] {",
      '  a',
      '  b',
      "  owner: 'platform-team'",
      '}',
    ].join('\n'));

    expect(diagnostics).toEqual([]);
    const group = model.elements.get('g');
    expect(group?.settings).toMatchObject({ name: 'G', owner: 'platform-team' });
    expect(isGroup(group) && group.children).toEqual(['a', 'b']);
  });

  it('leaves Note where it was, rather than treating it as a property', () => {
    const { model, diagnostics } = draw("Database d {\n  version: '16.3'\n  Note: 'the main one'\n}");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('d')?.note).toBe('the main one');
    expect(model.elements.get('d')?.settings).toEqual({ version: '16.3' });
  });

  it('lets the body win a collision, being the more specific place to have said it', () => {
    const { model } = draw("Database d [type: 'postgres', tier: 'two'] {\n  tier: 'one'\n}");
    expect(model.elements.get('d')?.settings).toMatchObject({ type: 'postgres', tier: 'one' });
  });

  it('refuses a key set twice in one body', () => {
    const { diagnostics } = draw("Database d {\n  a: '1'\n  a: '2'\n}");
    expect(diagnostics.map((x) => x.code)).toEqual(['duplicate-property']);
  });

  it('leaves a simple box on one line, which is most boxes', () => {
    const { model, diagnostics } = draw("Cache sessions [name: 'Session cache', type: 'redis']");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('sessions')?.settings).toEqual({
      name: 'Session cache', type: 'redis',
    });
  });
});

describe('flags in a body', () => {
  const draw = (src: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${src}` },
    '/d',
  );

  it('reads a bare word as true', () => {
    const { model, diagnostics } = draw("Database d {\n  type: 'postgres'\n  ssl\n}");
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('d')?.settings).toEqual({ type: 'postgres', ssl: true });
  });

  it('reads several on one line, as a group body reads several members', () => {
    const { model, diagnostics } = draw('Database d { login  superuser }');
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('d')?.settings).toEqual({ login: true, superuser: true });
  });

  it('refuses the same flag twice', () => {
    expect(draw('Database d {\n  ssl\n  ssl\n}').diagnostics.map((x) => x.code))
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
    expect(group?.settings).toEqual({ owner: 'platform-team' });
    expect(isGroup(group) && group.children).toEqual(['a']);
  });
});
