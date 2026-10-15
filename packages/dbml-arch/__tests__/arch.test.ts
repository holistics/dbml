import { describe, expect, it } from 'vitest';
import { Compiler, Filepath, MemoryProjectLayout } from '@dbml/parse';
import { compileArch, isArchitecture } from '../src/compile.js';
import { isIconName } from '../src/icons.js';
import { BUILTIN_KINDS, suggestKind } from '../src/vocabulary.js';
import {
  diagramTypeOf, isArchDiagramType, isArchitectureSource, scanFrontMatter,
} from '../src/frontmatter.js';
import { isGroup, isNode } from '../src/model.js';
import type { NetworkModel } from '../src/model.js';
import {
  BOOK_FILE, EXAMPLE_ENTRY, EXAMPLE_FILES, INLINE_FILE, SELF_FILE,
} from '../src/example.js';

const one = (src: string) => compileArch({ '/main.arch.dbml': src });
const codes = (src: string) => one(src).diagnostics.map((d) => d.code);

describe('the architecture dialect on DBML\'s grammar', () => {
  it('reads a bodyless declaration, which DBML itself has no use for', () => {
    const { model, diagnostics } = one('Database mongo1');
    expect(diagnostics).toEqual([]);
    expect(model.elements.get('mongo1')?.sort).toBe('node');
  });

  it('takes the label from a setting and falls back to the id', () => {
    const { model } = one("Server api1 [name: 'dbdiagram API1']\nServer api2");
    expect(model.elements.get('api1')?.label).toBe('dbdiagram API1');
    expect(model.elements.get('api2')?.label).toBe('api2');
  });

  it('puts the protocol and the host on the line, where they describe something', () => {
    // a node carries an icon and a name; the conversation is what the arrow is for, and the
    // same server answers on more than one of them
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

  it('opens the vocabulary with Kind, and closes it against anything else', () => {
    expect(codes('Microservice x')).toEqual(['unknown-kind']);
    expect(codes('Kind Microservice [icon: chip]\nMicroservice x')).toEqual([]);
  });

  it('warns on an icon nobody can draw, and still draws the box', () => {
    const { model, diagnostics } = one('Kind Weird [icon: sparkle]\nWeird w');
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-icon']);
    expect(diagnostics[0].message).toContain('draw your own');
    expect(model.elements.has('w')).toBe(true);
    expect(model.kinds.get('Weird')?.icon).toBe('box');
  });

  it('takes a mark the pack never had', () => {
    const { model } = one("Kind Snowflake [glyph: 'M12 3v18;M4 8l16 8', color: '#29b5e8']\nSnowflake dw");
    expect(model.kinds.get('Snowflake')?.glyph).toEqual(['M12 3v18', 'M4 8l16 8']);
    expect(model.kinds.get('Snowflake')?.color).toBe('#29b5e8');
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
    // the roles came from the pack, the elements and their brands from the entry
    expect(model.kinds.get('Lakehouse')?.icon).toBe('graph');
    expect(isNode(model.elements.get('mongo1')) && model.elements.get('mongo1'))
      .toMatchObject({ kind: 'Database', type: 'mongodb' });
    expect(model.elements.get('mongo1')?.parent).toBe('mongo_rs');
    expect(model.elements.get('mongo_rs')?.parent).toBe('production');
    expect(model.elements.get('production')?.parent).toBe('private_net');
  });

  it('attaches metadata declared outside the thing it describes', () => {
    const { model } = compileArch(EXAMPLE_FILES, EXAMPLE_ENTRY);
    expect(model.elements.get('api1')?.meta).toMatchObject({ owner: 'platform-team' });
  });

  it('produces a model that is complete enough to draw', () => {
    // the drawing itself is tested where the drawing lives; what this package owes is a model
    // whose every link names two things that exist
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
    const source = 'Kind Mongo [icon: mongodb]\nMongo m1\nServer a\nLink: a > m1';
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

  /**
   * THE MARKER LIVES IN FRONT MATTER, and `Project` is not an alternative to it.
   *
   * `database_type: 'PostgreSQL'` is a property of the DATABASE: it changes the SQL that
   * comes out and nothing about how the file is read. A diagram type describes the DOCUMENT
   * and says which pipeline should pick it up, which is a different kind of statement.
   *
   * It is also the only placement that can ever work. Finding a `Project` block means parsing
   * the file, and parsing is the thing being chosen; front matter is fenced, first, and comes
   * back from the lexer as one trivia token, so a host can read it without parsing anything.
   */
  it('reads diagram_type off front matter, and treats it as advice', () => {
    const marked = compileArch({ '/d.dbml': '---\ndiagram_type: arch\n---\n\nServer a' }, '/d.dbml');
    expect(marked.diagramType).toBe('arch');
    expect(marked.diagnostics).toEqual([]);

    // advice, not a mode: the drawing is identical without it
    const bare = compileArch({ '/d.dbml': 'Server a' }, '/d.dbml');
    expect(bare.diagramType).toBeNull();
    expect(bare.model.elements.size).toBe(marked.model.elements.size);
  });

  /**
   * NOT read from `Project`, and that is the point rather than an omission. Honouring it
   * there would produce a file that compiles here and cannot be routed by the host that has
   * to decide which compiler to call, which is worse than not working.
   */
  it('refuses to honour it inside Project, because a host cannot reach it there', () => {
    const misplaced = compileArch(
      { '/d.dbml': "Project x {\n  diagram_type: 'arch'\n}\nServer a" },
      '/d.dbml',
    );
    expect(misplaced.diagramType).toBeNull();
    expect(misplaced.diagnostics.map((d) => d.code)).toEqual(['diagram-type-not-here']);
    expect(misplaced.diagnostics[0].severity).toBe('error');
    expect(misplaced.diagnostics[0].message).toContain('diagram_type: arch');
    // the content heuristic still answers, which is what keeps the drawing on screen
    expect(isArchitecture(misplaced)).toBe(true);
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

  it('answers for a document that declares a vocabulary and has drawn nothing yet', () => {
    // inference says "unknown" here and the marker says "architecture". That gap is the whole
    // reason the marker exists: a canvas must not flicker while somebody is still typing.
    const { model, diagramType } = compileArch(
      { '/d.dbml': "---\ndiagram_type: arch\n---\nKind Mongo [icon: mongodb]" },
      '/d.dbml',
    );
    expect(model.elements.size).toBe(0);
    expect(diagramType).toBe('arch');
  });

  it('keeps Project out of the drawing', () => {
    const { model } = compileArch({ '/d.dbml': "---\ndiagram_type: arch\n---\nServer a" }, '/d.dbml');
    expect([...model.elements.keys()]).toEqual(['a']);
  });
});

describe('the naming convention', () => {
  it('resolves a .arch.dbml pack through the stock dbml resolver', () => {
    const { model, diagnostics } = compileArch({
      '/main.arch.dbml': "use * from './packs/devops.arch'\nMongo m1",
      '/packs/devops.arch.dbml': 'Kind Mongo [icon: mongodb]',
    }, '/main.arch.dbml');
    expect(diagnostics).toEqual([]);
    expect(model.kinds.get('Mongo')?.icon).toBe('mongodb');
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

  it('names an icon the renderer can be expected to have, for every kind it declares', () => {
    const { model } = compileArch({ '/d': INLINE_FILE }, '/d');
    for (const kind of model.kinds.values()) {
      if (kind.glyph) continue;
      expect(isIconName(kind.icon), `${kind.name} -> ${kind.icon}`).toBe(true);
    }
  });
});

describe('the self-portrait', () => {
  /**
   * A codebase is not a network, and this is the cheapest test of whether the twelve words
   * stretch that far: if the drawing of this package stops compiling, the language moved
   * under a diagram somebody is reading.
   */
  it('compiles with no diagnostics, drawing packages and imports rather than hosts', () => {
    const { model, diagnostics, diagramType } = compileArch({ '/self': SELF_FILE }, '/self');
    expect(diagnostics).toEqual([]);
    expect(diagramType).toBe('arch');
    expect(model.elements.size).toBeGreaterThan(20);
  });

  /**
   * Not one of the thirty-one built-in words fits a package or a source file, so the drawing
   * opens the vocabulary eight times and uses nothing it was given. That is the vocabulary
   * working as designed, and also the clearest argument for a second pack.
   */
  it('draws itself entirely out of kinds it declared, using no built-in word', () => {
    const { model, diagnostics } = compileArch({ '/self': SELF_FILE }, '/self');
    expect(diagnostics).toEqual([]);

    const declared = [...model.kinds.values()].filter((k) => !k.builtin);
    expect(declared.map((k) => k.name).sort()).toEqual(
      ['Author', 'Canvas', 'Closed', 'Lib', 'Shape', 'Stage', 'Words'],
    );
    for (const kind of declared) {
      expect(isIconName(kind.icon), `${kind.name} -> ${kind.icon}`).toBe(true);
    }

    const used = new Set([...model.elements.values()].filter(isNode).map((n) => n.kind));
    const builtinsUsed = [...used].filter((name) => model.kinds.get(name)?.builtin);
    expect(builtinsUsed).toEqual([]);
  });

  /**
   * A box per file was unreadable and a sticky note per listing was worse, so the listing is
   * a note ON the container, written as markdown. Two things have to hold for that: a group
   * has to carry a note at all (it silently dropped one until this was written), and the line
   * breaks have to survive, because a file list flattened to one line is a paragraph.
   */
  it('hangs a markdown listing off every container, line breaks intact', () => {
    const { model } = compileArch({ '/self': SELF_FILE }, '/self');
    const groups = [...model.elements.values()].filter(isGroup);
    expect(groups.length).toBeGreaterThan(3);

    for (const group of groups) {
      expect(group.note, `${group.id} has no note`).toBeTruthy();
      expect(group.note!.split('\n').length, `${group.id} is one line`).toBeGreaterThan(2);
      expect(group.note, `${group.id} lists nothing`).toContain('- `');
    }

    // the stickies are gone: the drawing is stages and containers, nothing else
    expect([...model.elements.values()].filter((e) => e.sort === 'note')).toEqual([]);
  });

  /**
   * A note is not a container feature. The same body works on a node, which matters because
   * the question a reader has about a box is usually about THAT box, not about the room it
   * is standing in.
   */
  it('takes the same note on a node, with no change to the syntax', () => {
    const { model, diagnostics } = compileArch({ '/self': SELF_FILE }, '/self');
    expect(diagnostics).toEqual([]);

    const lexer = model.elements.get('lex');
    expect(lexer?.sort).toBe('node');
    expect(lexer?.note).toContain('642 lines');
    expect(lexer?.note).toContain('- `allowFrontMatter`');
    expect(lexer?.note!.split('\n').length).toBeGreaterThan(3);

    // most of the stages carry one: the drawing is the pipeline, the notes are the detail
    const noted = [...model.elements.values()].filter((e) => isNode(e) && e.note);
    expect(noted.length).toBeGreaterThan(8);
    for (const node of noted) {
      expect(node.note!.split('\n').length, node.id).toBeGreaterThan(2);
    }
  });

  it('strips the indentation the author used, so the markdown starts at column one', () => {
    const { model } = compileArch({ '/self': SELF_FILE }, '/self');
    const note = model.elements.get('archpkg')?.note ?? '';
    expect(note.startsWith('**')).toBe(true);
    for (const line of note.split('\n')) {
      expect(line === line.trimStart() || line.startsWith('  '), line).toBe(true);
    }
  });
});

describe('deciding whether to show an architecture canvas', () => {
  const asks = (src: string) => isArchitecture(compileArch({ '/d.dbml': src }, '/d.dbml'));

  it('says no to a DBML schema, which is what keeps the tab off a public page', () => {
    expect(asks('Table users {\n  id int [pk]\n}')).toBe(false);
    expect(asks('Enum status { draft\n published }')).toBe(false);
    expect(asks('')).toBe(false);
  });

  it('says no to a vocabulary with nothing drawn on it, unless the author said otherwise', () => {
    expect(asks('Kind Mongo [icon: mongodb]')).toBe(false);
    expect(asks("---\ndiagram_type: arch\n---\nKind Mongo [icon: mongodb]")).toBe(true);
  });

  it('says no to notes alone, which a half-written file collects by accident', () => {
    expect(asks("Note n { 'just thinking' }")).toBe(false);
  });

  it('says yes once something is drawn, with no marker and no filename', () => {
    expect(asks('Server api1')).toBe(true);
    expect(asks('Kind Mongo [icon: mongodb]\nMongo m1')).toBe(true);
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
    // the schema is not this dialect's business, and reporting `Table is not a kind` against a
    // file nobody asked it to read is worse than useless: it buries the real diagnostics
    expect(diagnostics).toEqual([]);
    expect(model.files).toEqual(['/infra.arch.dbml']);
    expect(model.elements.size).toBe(2);
  });

  it('still follows what the entry point imports', () => {
    const { model, diagnostics } = compileArch({
      '/main.dbml': 'Table users {\n  id int [pk]\n}',
      '/infra.arch.dbml': "use * from './packs/devops.arch'\nMongo m1",
      '/packs/devops.arch.dbml': 'Kind Mongo [icon: mongodb]',
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
    expect(diagnostics).toHaveLength(1);
    // the block is four lines, so the error belongs on line 4 and not on line 1
    expect(diagnostics[0]).toMatchObject({ line: 4, column: 1 });
  });

  it('leaves a document alone when the fence is never closed', () => {
    const { model, diagnostics } = compileArch({ '/d.dbml': '---\ntitle: x\nServer a' }, '/d.dbml');
    expect(model.frontMatter).toEqual({});
    expect(diagnostics.length).toBeGreaterThan(0); // it is text, and text is not a declaration
  });

  it('is off for DBML, so a stock compiler never looks for a fence', () => {
    expect(new Compiler(new MemoryProjectLayout()).dialect.lexer?.allowFrontMatter).toBeUndefined();
  });
});

describe('the example carries both kinds of metadata', () => {
  it('reads the --- block and the Project block from the same document', () => {
    const { model, diagramType, diagnostics } = compileArch({ '/d': INLINE_FILE }, '/d');
    expect(diagnostics).toEqual([]);
    expect(model.frontMatter.title).toBe('DBX network diagram');
    expect(model.frontMatter.owner).toBe('platform-team');
    // Project is for what the editor needs to know, front matter is for whoever reads the file
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

/**
 * EVIDENCE THAT THE DESIGN GENERALISES, OR THE PLACE WHERE IT DOES NOT.
 *
 * Every other sample in this package describes software, which is the domain the language was
 * lifted from, so none of them can tell us whether `Kind`, `Group` and `Link` are a general
 * shape or a shape fitted to its own examples. A book is the cheapest way to ask, and the
 * useful part of the answer is the part that does not work.
 */
describe('a book, drawn with a vocabulary meant for servers', () => {
  it('compiles an argument with no diagnostics, in Vietnamese', () => {
    const { model, diagnostics, diagramType } = compileArch({ '/b': BOOK_FILE }, '/b');
    expect(diagnostics).toEqual([]);
    expect(diagramType).toBe('arch');
    expect(model.elements.size).toBeGreaterThan(30);
    expect(model.links.length).toBeGreaterThan(30);
  });

  /**
   * Diacritics are the part people assume will break. They do not: the lexer asks whether a
   * character can start or continue an identifier, not whether it is ASCII.
   */
  it('lexes Vietnamese as identifiers, so a name and a kind can be written in it', () => {
    const { model } = compileArch({ '/b': BOOK_FILE }, '/b');
    expect(model.elements.has('mục_đích_luận')).toBe(true);
    expect(model.elements.get('mục_đích_luận')?.label).toBe('Mục đích luận');

    const declared = [...model.kinds.values()].filter((k) => !k.builtin).map((k) => k.name);
    expect(declared).toContain('Tiền_đề');
    expect(declared).toContain('Luận_điểm');
    expect(declared.length).toBe(6);
  });

  /**
   * Not one built-in word survives the move off infrastructure, and the vocabulary opens six
   * times without complaint. That is `Kind` doing its job on a domain nobody designed it for.
   */
  it('uses no built-in kind, because none of the thirty-one describes an argument', () => {
    const { model } = compileArch({ '/b': BOOK_FILE }, '/b');
    const used = new Set([...model.elements.values()].filter(isNode).map((n) => n.kind));
    expect([...used].filter((name) => model.kinds.get(name)?.builtin)).toEqual([]);
  });

  /**
   * THE PART THAT DID NOT GENERALISE, asserted so it cannot be quietly forgotten.
   *
   * An argument's edges are `refutes`, `leads to` and `requires`. The language has four
   * operators and one label slot, and that slot is called `proto`. Every edge below is a
   * relation between ideas wearing a network word, which is the strongest evidence in this
   * package that the LINE's vocabulary is still shaped by where it was lifted from.
   */
  it('spells every relation as proto, which is a network word on an argument', () => {
    const { model } = compileArch({ '/b': BOOK_FILE }, '/b');

    const labelled = model.links.filter((link) => link.settings.proto !== undefined);
    expect(labelled.length).toBeGreaterThan(10);
    expect(labelled.some((link) => link.settings.proto === 'bác bỏ')).toBe(true);

    // nothing on any of these lines is a protocol or a host
    expect(model.links.some((link) => link.settings.host !== undefined)).toBe(false);
    expect(new Set(model.links.map((link) => link.op))).toEqual(new Set(['>', '-']));
  });
});

/**
 * THE DEVOPS CASE, WHICH IS THE CASE.
 *
 * Every estate diagram in the wild is mostly brands. They were keywords for a while, which was
 * the wrong shape: DBML does not have a `PostgresTable`, it has `Table` and a setting. So the
 * keyword is the ROLE and `type` is the BRAND, and the vocabulary a reader learns went from 73
 * words back to 31.
 */
describe('a brand is a setting, not a keyword', () => {
  const draw = (line: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${line}` },
    '/d',
  );

  it('keeps the role and the brand as two separate facts', () => {
    const { model, diagnostics } = draw("Proxy lb1 [name: \"ha 1\", type: 'haproxy']");
    expect(diagnostics).toEqual([]);

    const lb = model.elements.get('lb1');
    expect(isNode(lb) && lb).toMatchObject({ kind: 'Proxy', type: 'haproxy', label: 'ha 1' });
  });

  /**
   * The point of keeping both. A drawing can be asked which of its boxes are databases, which
   * it could not be when the box simply said `Postgres` and the role had been thrown away.
   */
  it('can still be asked which boxes are databases, whatever vendor they run', () => {
    const { model } = draw([
      "Database users_db [type: 'postgres']",
      "Database events [type: 'mongodb']",
      "Cache sessions [type: 'redis']",
      "Proxy lb [type: 'haproxy']",
    ].join('\n'));

    const databases = [...model.elements.values()].filter(isNode).filter((n) => n.kind === 'Database');
    expect(databases.map((n) => n.id)).toEqual(['users_db', 'events']);
    expect(databases.map((n) => n.type)).toEqual(['postgres', 'mongodb']);
  });

  /**
   * The spelling problem evaporated with the keywords. `pg`, `postgres` and `postgresql` were
   * going to be three keywords each; they are already one alias table in the icon pack.
   */
  it('resolves the spellings people type through the pack aliases', () => {
    for (const [typed, resolved] of [['pg', 'postgres'], ['postgresql', 'postgres'],
      ['mongo', 'mongodb'], ['k8s', 'kubernetes'], ['elasticsearch', 'elastic']]) {
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

  /**
   * Anyone who wrote the brand as a keyword gets told where it went, not "declare it", which
   * would send them off to write a `Kind` line for something the language already handles.
   */
  it('tells a brand used as a keyword which setting it belongs in', () => {
    const { diagnostics } = draw('Postgres users_db');
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-kind']);
    expect(diagnostics[0].message).toContain("Database name [type: 'postgres']");
  });

  it('still suggests the near role for a word that is neither', () => {
    const { diagnostics } = draw('Databse d');
    expect(diagnostics[0].message).toContain('Database');
    expect(suggestKind('Zarf')).toContain('Kind Zarf');
  });

  it('warns on a type nobody can draw, and keeps the box', () => {
    const { model, diagnostics } = draw("Database d [type: 'postgress']");
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-type']);
    expect(diagnostics[0].message).toContain('postgres');
    expect(isNode(model.elements.get('d')) && model.elements.get('d')).toMatchObject({ type: null });
  });

  /**
   * THE ANSWER TO "a brand the pack has never drawn". It is the same setting: no second word
   * to learn, and nothing else about the declaration changes.
   */
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

  it('leaves the pack for what only a pack can do', () => {
    const { model, diagnostics } = compileArch(EXAMPLE_FILES, EXAMPLE_ENTRY);
    expect(diagnostics).toEqual([]);

    const declared = [...model.kinds.values()].filter((k) => !k.builtin).map((k) => k.name);
    expect(declared.sort()).toEqual(['Firewall', 'Lakehouse']);
    // one overrules a built-in role, the other names a role the built-ins lack
    expect(model.kinds.get('Firewall')?.color).toBe('#c0453a');
    expect(model.kinds.get('Lakehouse')?.builtin).toBe(false);
  });

  it('has 31 roles and no brands among them', () => {
    expect(Object.keys(BUILTIN_KINDS)).toHaveLength(31);
    for (const brand of ['Postgres', 'Mongo', 'Redis', 'HAProxy', 'Docker', 'Kubernetes']) {
      expect(BUILTIN_KINDS[brand], brand).toBeUndefined();
    }
  });
});

/**
 * A PICTURE GOES IN THE SLOT THAT ALREADY NAMES THE MARK.
 *
 * There is no `image` setting and there should not be one: an element's picture is its
 * `type`, a kind's is its `icon`, and which you write is decided by what you are describing
 * rather than by whether you have a name or a URL in hand.
 */
describe('a picture, in the slot that already names the mark', () => {
  const draw = (body: string) => compileArch(
    { '/d': `---\ndiagram_type: arch\n---\n\n${body}` },
    '/d',
  );
  const pictureOf = (model: NetworkModel, id: string): string | null => {
    const element = model.elements.get(id);
    return isNode(element) ? element.image : null;
  };

  it('takes a URL where a kind names its mark', () => {
    const { model, diagnostics } = draw([
      "Kind Vendor [icon: 'https://example.com/vendor.svg']",
      'Vendor billing',
    ].join('\n'));
    expect(diagnostics).toEqual([]);
    expect(model.kinds.get('Vendor')?.image).toBe('https://example.com/vendor.svg');
    // the mark falls back to a box, so a failed fetch still leaves something to draw
    expect(model.kinds.get('Vendor')?.icon).toBe('box');
  });

  it('takes a data URI as readily as a URL', () => {
    const { diagnostics, model } = draw("Database d [type: 'data:image/png;base64,iVBORw0KGgo=']");
    expect(diagnostics).toEqual([]);
    expect(pictureOf(model, 'd')).toContain('data:image/png');
  });

  /**
   * NOT A FORMALITY. The string becomes an `href` inside an SVG in somebody else's page, and
   * a `javascript:` href there executes. The author of a diagram is not always the person
   * opening it: a file arrives in a pull request, a document is shared from another team.
   */
  it('refuses a scheme that would execute, or break on a TLS page, in both slots', () => {
    for (const bad of ['javascript:alert(1)', 'http://example.com/a.png', 'file:///etc/passwd',
      'data:text/html,<script>']) {
      const onType = draw(`Database d [type: '${bad}']`);
      expect(pictureOf(onType.model, 'd'), bad).toBe(null);
      expect(onType.diagnostics.map((d) => d.code), bad).toEqual(['bad-image']);

      const onKind = draw(`Kind Vendor [icon: '${bad}']\nVendor v`);
      expect(onKind.model.kinds.get('Vendor')?.image, bad).toBe(null);
      expect(onKind.diagnostics.map((d) => d.code), bad).toEqual(['bad-image']);
    }
  });

  it('lets an element overrule the picture its kind carries', () => {
    const { model, diagnostics } = draw([
      "Kind Vendor [icon: 'https://example.com/vendor.svg']",
      'Vendor a',
      "Vendor b [type: 'https://example.com/other.svg']",
    ].join('\n'));
    expect(diagnostics).toEqual([]);
    expect(pictureOf(model, 'a')).toBe(null);
    expect(model.kinds.get('Vendor')?.image).toBe('https://example.com/vendor.svg');
    expect(pictureOf(model, 'b')).toBe('https://example.com/other.svg');
  });

  it('has no image setting at all, which is the point', () => {
    const { model, diagnostics } = draw("Database d [image: 'https://example.com/a.svg']");
    expect(diagnostics).toEqual([]);
    expect(pictureOf(model, 'd')).toBe(null);
    // it survives as a free-form property, the way any unknown setting does
    expect(model.elements.get('d')?.settings.image).toBe('https://example.com/a.svg');
  });
});

/**
 * A KIND WORD SITS WHERE `Table` SITS, so it behaves the way `Table` behaves.
 *
 * DBML matches every keyword on `value.toLowerCase()`. This dialect did not, and the result
 * was the worst kind of inconsistency: `database api` reported that `database` is not a kind,
 * while `Database api` on the next line worked. Nothing in the language explained why.
 */
describe('a kind word is case-insensitive, because Table is', () => {
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

  /**
   * The author's casing is NOT kept. Everything downstream looks a kind up by name — the
   * renderer's icon, a tooltip, a host reading the model — and two spellings of one word
   * would be two kinds to all of them.
   */
  it('records the canonical spelling, whatever was typed', () => {
    const { model } = draw('loadbalancer a');
    expect(isNode(model.elements.get('a')) && model.elements.get('a')).toMatchObject({ kind: 'LoadBalancer' });
    expect(model.kinds.get('LoadBalancer')?.icon).toBe('balancer');
  });

  it('refuses a reserved word in any casing, the way it refuses the capital one', () => {
    for (const spelling of ['Group', 'group', 'GROUP', 'note', 'link']) {
      const { diagnostics } = draw(`Kind ${spelling} [icon: box]`);
      expect(diagnostics.map((d) => d.code), spelling).toEqual(['reserved-kind']);
    }
  });

  /**
   * Overruling a built-in is what a pack is for, and it has to work however the author spells
   * it. One entry per word, not two differing only in case.
   */
  it('overrules a built-in word declared in another case, instead of sitting beside it', () => {
    const { model, diagnostics } = compileArch({
      '/d': [
        "---", 'diagram_type: arch', "---",
        "Kind database [icon: database, color: '#c0453a']",
        'Database a',
      ].join('\n'),
    }, '/d');

    expect(diagnostics).toEqual([]);
    const entries = [...model.kinds.values()].filter((k) => k.name.toLowerCase() === 'database');
    expect(entries).toHaveLength(1);
    expect(entries[0].color).toBe('#c0453a');
    expect(isNode(model.elements.get('a')) && model.elements.get('a')).toMatchObject({ kind: 'database' });
  });

  it('has no two built-in words differing only in case, which would make the table ambiguous', () => {
    const lowered = Object.keys(BUILTIN_KINDS).map((name) => name.toLowerCase());
    expect(new Set(lowered).size).toBe(lowered.length);
  });
});

/**
 * ROUTING A DOCUMENT BEFORE PARSING IT.
 *
 * A host holding a string has to answer one question first: database schema, or architecture
 * diagram? The two want different parser options, a different module list and a different
 * renderer, so the answer must arrive BEFORE any of those are chosen. That is possible only
 * because the marker is in front matter: the block is fenced, it is first, and reading it is a
 * regular expression over the head of a string.
 */
describe('the marker chooses the pipeline, which is why it is in front matter', () => {
  const ARCH = "---\ndiagram_type: arch\n---\n\nPostgres main\nRedis cache";
  const SCHEMA = "Project p {\n  database_type: 'PostgreSQL'\n}\n\nTable users {\n  id int [pk]\n}";

  it('reads the type off a raw string, with no lexer and no parser', () => {
    expect(diagramTypeOf(ARCH)).toBe('arch');
    expect(diagramTypeOf(SCHEMA)).toBeNull();
    expect(isArchitectureSource(ARCH)).toBe(true);
    expect(isArchitectureSource(SCHEMA)).toBe(false);
  });

  it('never throws, so routing cannot fail on anything a person can type', () => {
    for (const nonsense of ['', '---', '---\n', '--- \n---', '{{{', '\u0000', '---\nx\n---',
      'a'.repeat(50000), '---\ndiagram_type\n---', '---\n: arch\n---']) {
      expect(() => diagramTypeOf(nonsense)).not.toThrow();
    }
    expect(diagramTypeOf('---\ndiagram_type\n---')).toBeNull();
    expect(diagramTypeOf('---\n: arch\n---')).toBeNull();
  });

  it('only counts a fenced block at the very top', () => {
    expect(diagramTypeOf('Server a\n\n---\ndiagram_type: arch\n---')).toBeNull();
    expect(diagramTypeOf('// a comment\n---\ndiagram_type: arch\n---')).toBeNull();
    expect(diagramTypeOf('\n\n---\ndiagram_type: arch\n---\nServer a')).toBe('arch');
    expect(diagramTypeOf('---\r\ndiagram_type: arch\r\n---\r\nServer a')).toBe('arch');
  });

  it('takes a quoted value and any casing of the two spellings', () => {
    expect(diagramTypeOf("---\ndiagram_type: 'arch'\n---")).toBe('arch');
    expect(diagramTypeOf('---\ndiagram_type: "architecture"\n---')).toBe('architecture');
    for (const spelling of ['arch', 'Arch', 'ARCH', 'architecture', 'Architecture']) {
      expect(isArchDiagramType(spelling), spelling).toBe(true);
    }
    for (const other of ['database', 'dbml', '', null, undefined, 'archive']) {
      expect(isArchDiagramType(other as string), String(other)).toBe(false);
    }
  });

  /**
   * THE INVARIANT THAT MATTERS. The cheap scan routes the document and the compiler reads the
   * same block properly a moment later. If the two ever disagree, a file is sent to one
   * pipeline and then describes itself as the other, and the symptom is a blank canvas nobody
   * can explain.
   */
  it('agrees with what the compiler reads out of the same block, on every sample', () => {
    const samples: Record<string, string> = {
      inline: INLINE_FILE, self: SELF_FILE, book: BOOK_FILE, main: EXAMPLE_FILES[EXAMPLE_ENTRY],
    };
    for (const [name, source] of Object.entries(samples)) {
      const scanned = scanFrontMatter(source);
      const { model } = compileArch({ '/d.arch.dbml': source }, '/d.arch.dbml');
      for (const [key, value] of Object.entries(scanned)) {
        expect(model.frontMatter[key], `${name}.${key}`).toBe(value);
      }
      expect(diagramTypeOf(source), name).toBe(
        compileArch({ '/d.arch.dbml': source }, '/d.arch.dbml').diagramType,
      );
    }
  });

  it('routes every sample this package ships to the architecture compiler', () => {
    for (const source of [INLINE_FILE, SELF_FILE, BOOK_FILE, EXAMPLE_FILES[EXAMPLE_ENTRY]]) {
      expect(isArchitectureSource(source)).toBe(true);
    }
  });
});

/**
 * A VERSION IS A STRING THAT HAPPENS TO BE DIGITS.
 *
 * `numberOf` called `Number()` on any literal it found, so `engine_version: '16.3'` arrived
 * as the number 16.3 and `'16.30'` arrived as 16.3 as well. Harmless on a drawing; fatal to
 * anything generating configuration out of the model, where a version, a zero-padded zone and
 * an account id are all strings made of digits.
 */
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

  /**
   * Everything an infrastructure tool would want already parses, on elements, on links and on
   * containers, with no change to the grammar at all. Whether any of it should be there is a
   * separate question; that it survives is what makes the question worth asking.
   */
  it('carries free-form settings through to the model, wherever they are written', () => {
    const { model, diagnostics } = compileArch({
      '/d': [
        '---', 'diagram_type: arch', '---', '',
        "Database pg [type: 'postgres', region: 'ap-southeast-1', instance_class: 'db.t3.medium']",
        "Server api [type: 'docker']",
        "Link: api > pg [proto: TCP, port: 5432]",
        "Group vpc [name: 'Production', cidr: '10.0.0.0/16'] { api pg }",
        'Metadata pg {',
        '  tf_module \'modules/rds\'',
        '}',
      ].join('\n'),
    }, '/d');

    expect(diagnostics).toEqual([]);
    expect(model.elements.get('pg')?.settings).toMatchObject({
      region: 'ap-southeast-1', instance_class: 'db.t3.medium',
    });
    expect(model.links[0].settings).toMatchObject({ proto: 'TCP', port: 5432 });
    expect(model.elements.get('vpc')?.settings).toMatchObject({ cidr: '10.0.0.0/16' });
    expect(model.elements.get('pg')?.meta).toMatchObject({ tf_module: 'modules/rds' });
  });
});
