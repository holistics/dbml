import { describe, expect, it } from 'vitest';
import { Compiler, Filepath, MemoryProjectLayout } from '@dbml/parse';
import { compileArch, isArchitecture } from '../src/compile.js';
import { isIconName } from '../src/icons.js';
import { isGroup, isNode } from '../src/model.js';
import {
  EXAMPLE_ENTRY, EXAMPLE_FILES, INLINE_FILE, SELF_FILE,
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
    // the kinds came from the pack, the elements from the entry
    expect(model.kinds.get('Mongo')?.icon).toBe('mongodb');
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

  it('reads diagram_type off Project, and treats it as advice', () => {
    const marked = compileArch({ '/d.dbml': "Project x {\n  diagram_type: 'architecture'\n}\nServer a" }, '/d.dbml');
    expect(marked.diagramType).toBe('architecture');
    expect(marked.diagnostics).toEqual([]);
    // advice, not a mode: the drawing is identical without it
    const bare = compileArch({ '/d.dbml': 'Server a' }, '/d.dbml');
    expect(bare.diagramType).toBeNull();
    expect(bare.model.elements.size).toBe(marked.model.elements.size);
  });

  it('answers for a document that declares a vocabulary and has drawn nothing yet', () => {
    // inference says "unknown" here and the marker says "architecture". That gap is the whole
    // reason the marker exists: a canvas must not flicker while somebody is still typing.
    const { model, diagramType } = compileArch(
      { '/d.dbml': "Project x {\n  diagram_type: 'architecture'\n}\nKind Mongo [icon: mongodb]" },
      '/d.dbml',
    );
    expect(model.elements.size).toBe(0);
    expect(diagramType).toBe('architecture');
  });

  it('keeps Project out of the drawing', () => {
    const { model } = compileArch({ '/d.dbml': "Project x {\n  diagram_type: 'architecture'\n}\nServer a" }, '/d.dbml');
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
    expect(diagramType).toBe('architecture');
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
    expect(diagramType).toBe('architecture');
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
    expect(asks("Project x {\n  diagram_type: 'architecture'\n}\nKind Mongo [icon: mongodb]")).toBe(true);
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
    expect(diagramType).toBe('architecture');
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
