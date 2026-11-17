import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler/index';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import { SymbolKind } from '@/core/types/symbol';
import type { ArchElementIdentifier, ElementIdentifier } from '@/compiler/queries/transform/types';
import type { Database } from '@/core/types/schemaJson/types';
import { applyTextEdits } from '@/compiler/queries/transform/applyTextEdits';

function createCompiler (source: string): Compiler {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, source);
  return new Compiler(layout);
}

// The architecture sources below leave out their front matter: the helpers add it, and take it off what they return
const FRONT_MATTER = `---
diagram_type: arch
---
`;

function withoutFrontMatter (text: string): string {
  expect(text.startsWith(FRONT_MATTER)).toBe(true);
  return text.slice(FRONT_MATTER.length);
}

function update (source: string, target: ElementIdentifier, settingName: string, value: string | null | undefined): string {
  return withoutFrontMatter(createCompiler(FRONT_MATTER + source).updateElementSetting(DEFAULT_ENTRY, target, settingName, value));
}

function collectDiagnostics (source: string): string[] {
  const compiler = createCompiler(FRONT_MATTER + source);
  const { ast } = compiler.parseFile(DEFAULT_ENTRY).getValue();
  return [
    ...compiler.parseFile(DEFAULT_ENTRY).getErrors(),
    ...compiler.validateFile(DEFAULT_ENTRY).getErrors(),
    ...compiler.bindNode(ast).getErrors(),
    ...compiler.interpretFile(DEFAULT_ENTRY).getErrors(),
  ].map((e) => e.diagnostic);
}

function rename (source: string, oldHandle: string, newName: string): string {
  const changes = createCompiler(FRONT_MATTER + source).renameElement(DEFAULT_ENTRY, oldHandle, newName);
  return withoutFrontMatter(changes.get(DEFAULT_ENTRY.absolute) ?? FRONT_MATTER + source);
}

describe('updateElementSetting - architecture element', () => {
  it('creates the settings list before the body', () => {
    const source = `Server api {
  type: 'nginx'
}`;
    expect(update(source, { kind: SymbolKind.Element, name: 'api' }, 'color', '#ff0000')).toBe(`Server api [color: #ff0000] {
  type: 'nginx'
}`);
  });

  it('creates the settings list after the alias of a bodyless element', () => {
    const source = `Server "API 1" as api1
Database db`;
    const result = update(source, { kind: SymbolKind.Element, name: 'api1' }, 'color', '#ff0000');
    expect(result).toBe(`Server "API 1" as api1 [color: #ff0000]
Database db`);
    expect(collectDiagnostics(result)).toEqual([]);
  });

  it('updates a setting in an existing list', () => {
    const source = `Server "API 1" as api1 [color: #c0453a, icon: server] {
}`;
    expect(update(source, { kind: SymbolKind.Element, name: 'api1' }, 'color', '#ff0000')).toBe(`Server "API 1" as api1 [color: #ff0000, icon: server] {
}`);
  });

  it('appends to an existing list that lacks the setting', () => {
    const source = 'Server api [icon: server]';
    expect(update(source, { kind: SymbolKind.Element, name: 'api' }, 'color', '#ff0000')).toBe('Server api [icon: server, color: #ff0000]');
  });

  it('removes a setting when value is null', () => {
    const source = 'Server api [color: #ff0000]';
    expect(update(source, { kind: SymbolKind.Element, name: 'api' }, 'color', null)).toBe('Server api');
  });

  it('finds a group and a note by handle', () => {
    const source = `Server api
Group "Prod" as prod {
  api
}
Note memo {
  'text'
}`;
    expect(update(source, { kind: SymbolKind.Element, name: 'prod' }, 'color', '#00ff00')).toBe(`Server api
Group "Prod" as prod [color: #00ff00] {
  api
}
Note memo {
  'text'
}`);
    expect(update(source, { kind: SymbolKind.Element, name: 'memo' }, 'color', '#00ff00')).toBe(`Server api
Group "Prod" as prod {
  api
}
Note memo [color: #00ff00] {
  'text'
}`);
  });

  it('does not match an element by its name when it has an alias', () => {
    const source = 'Server "API 1" as api1';
    expect(update(source, { kind: SymbolKind.Element, name: 'API 1' }, 'color', '#ff0000')).toBe(source);
  });

  it('returns the source unchanged when no element has that handle', () => {
    const source = 'Server api';
    expect(update(source, { kind: SymbolKind.Element, name: 'web' }, 'color', '#ff0000')).toBe(source);
  });

  it('does not read a DBML table as an element', () => {
    const source = `Table users {
  id int
}`;
    expect(createCompiler(source).updateElementSetting(DEFAULT_ENTRY, { kind: SymbolKind.Element, name: 'users' }, 'color', '#ff0000')).toBe(source);
  });
});

describe('updateElementSetting - architecture link', () => {
  const elements = `Server api
Database db
`;

  it('creates the settings list after the endpoints', () => {
    const source = `${elements}Link: api > db`;
    const result = update(source, { kind: 'Link', from: 'api', to: 'db' }, 'color', '#ff0000');
    expect(result).toBe(`${elements}Link: api > db [color: #ff0000]`);
    expect(collectDiagnostics(result)).toEqual([]);
  });

  it('updates a setting in an existing list', () => {
    const source = `${elements}Link: api > db [proto: HTTPS, color: #000000]`;
    expect(update(source, { kind: 'Link', from: 'api', to: 'db' }, 'color', '#ff0000')).toBe(`${elements}Link: api > db [proto: HTTPS, color: #ff0000]`);
  });

  it('matches the link in either direction', () => {
    const source = `${elements}Link: api > db [proto: HTTPS]`;
    expect(update(source, { kind: 'Link', from: 'db', to: 'api' }, 'color', '#ff0000')).toBe(`${elements}Link: api > db [proto: HTTPS, color: #ff0000]`);
  });

  it('writes the first matching link only', () => {
    const source = `${elements}Link: api > db
Link: db - api`;
    expect(update(source, { kind: 'Link', from: 'api', to: 'db' }, 'color', '#ff0000')).toBe(`${elements}Link: api > db [color: #ff0000]
Link: db - api`);
  });

  it('removes a setting when value is null', () => {
    const source = `${elements}Link: api > db [color: #ff0000]`;
    expect(update(source, { kind: 'Link', from: 'api', to: 'db' }, 'color', null)).toBe(`${elements}Link: api > db`);
  });

  it('returns the source unchanged when no link joins the two', () => {
    const source = `${elements}Server web
Link: api > db`;
    expect(update(source, { kind: 'Link', from: 'api', to: 'web' }, 'color', '#ff0000')).toBe(source);
  });
});

describe('renameElement', () => {
  it('renames only the name when the element has an alias', () => {
    const source = `Server "API 1" as api1
Database db
Group prod {
  api1
}
Link: api1 > db
Metadata api1 {
  owner: 'x'
}`;
    expect(rename(source, 'api1', 'API 2')).toBe(source.replace('"API 1"', '"API 2"'));
  });

  it('renames every reference when the name is the handle', () => {
    const source = `Server api
Database db
Group prod [color: #c0453a] {
  api
  db
}
Link: api > db [proto: HTTPS]
Link: db < api
Metadata Server api {
  owner: 'x'
}
Metadata api {
  team: 'y'
}`;
    expect(rename(source, 'api', 'web')).toBe(`Server web
Database db
Group prod [color: #c0453a] {
  Server web
  db
}
Link: Server web > db [proto: HTTPS]
Link: db < Server web
Metadata Server web {
  owner: 'x'
}
Metadata Server web {
  team: 'y'
}`);
    expect(collectDiagnostics(rename(source, 'api', 'web'))).toEqual([]);
  });

  it('quotes a new name that is not a plain identifier', () => {
    const source = `Server api
Database db
Group prod {
  api
}
Link: api > db
Metadata Server api {
  owner: 'x'
}`;
    const result = rename(source, 'api', 'API 2');
    expect(result).toBe(`Server "API 2"
Database db
Group prod {
  Server "API 2"
}
Link: Server "API 2" > db
Metadata Server "API 2" {
  owner: 'x'
}`);
    expect(collectDiagnostics(result)).toEqual([]);
  });

  it('adds the declaration word when a quoted name replaces a bare metadata target', () => {
    const source = `Group prod {
}
Metadata prod {
  owner: 'x'
}`;
    const result = rename(source, 'prod', 'Prod 1');
    expect(result).toBe(`Group "Prod 1" {
}
Metadata Group "Prod 1" {
  owner: 'x'
}`);
    expect(collectDiagnostics(result)).toEqual([]);
  });

  it('keeps double quotes when the name was quoted', () => {
    const source = `Server "api"
Database db
Link: "api" > db
Metadata api {
  owner: 'x'
}`;
    expect(rename(source, 'api', 'web')).toBe(`Server "web"
Database db
Link: Server "web" > db
Metadata Server "web" {
  owner: 'x'
}`);
  });

  it('renames a group and a note', () => {
    const source = `Server api
Group prod {
  api
}
Note memo {
  'text'
}
Group outer {
  prod
  memo
}`;
    expect(rename(source, 'prod', 'live')).toBe(source.replace('Group prod', 'Group live').replace('  prod\n', '  Group live\n'));
    expect(rename(source, 'memo', 'remark')).toBe(source.replace('Note memo', 'Note remark').replace('  memo\n', '  Note remark\n'));
  });

  it('leaves a link setting value that happens to match the name', () => {
    const source = `Server api
Database db
Link: api > db [label: api]`;
    expect(rename(source, 'api', 'web')).toBe(`Server web
Database db
Link: Server web > db [label: api]`);
  });

  it('is a no-op when the new handle is already taken', () => {
    const source = `Server api
Server web`;
    expect(rename(source, 'api', 'web')).toBe(source);
  });

  it('is a no-op when no element has that handle', () => {
    const source = 'Server api';
    expect(createCompiler(FRONT_MATTER + source).renameElement(DEFAULT_ENTRY, 'web', 'other').size).toBe(0);
  });

  it('does not rename a DBML table', () => {
    const source = `Table users {
  id int
}`;
    expect(createCompiler(source).renameElement(DEFAULT_ENTRY, 'users', 'customers').size).toBe(0);
  });
});

const server = (name: string): ArchElementIdentifier => ({ name, role: 'Server' });

// Extract group membership from the interpreted arch result
function extractGroups (text: string): Record<string, string[]> {
  const value = createCompiler(text).interpretFile(DEFAULT_ENTRY).getValue() as Database;
  return Object.fromEntries((value.groups ?? []).map((g) => [
    g.alias ?? g.name,
    g.children.map((child) => child.handle),
  ]));
}

// Apply a groupElementsEdit and return the resulting source
function applyGroup (source: string, members: ArchElementIdentifier[], parent: string | null, name: string): string {
  const edits = createCompiler(FRONT_MATTER + source).groupElementsEdit(DEFAULT_ENTRY, members, parent, name);
  return applyTextEdits(FRONT_MATTER + source, edits);
}

// Apply an ungroupElementsEdit and return the resulting source
function applyUngroup (source: string, handle: string, members: ArchElementIdentifier[], parent: string | null): string {
  const edits = createCompiler(FRONT_MATTER + source).ungroupElementsEdit(DEFAULT_ENTRY, handle, members, parent);
  return applyTextEdits(FRONT_MATTER + source, edits);
}

describe('renameElementEdit', () => {
  it('gives the edits renameElement applies', () => {
    const source = `${FRONT_MATTER}Server api
Database db
Group prod {
  api
  db
}
Link: api > db`;
    const compiler = createCompiler(source);
    const edits = compiler.renameElementEdit(DEFAULT_ENTRY, 'api', 'web');
    expect(applyTextEdits(source, edits)).toBe(createCompiler(source).renameElement(DEFAULT_ENTRY, 'api', 'web').get(DEFAULT_ENTRY.absolute));
  });

  it('gives no edits when the new handle is already taken', () => {
    expect(createCompiler(`${FRONT_MATTER}Server api
Server web`).renameElementEdit(DEFAULT_ENTRY, 'api', 'web')).toEqual([]);
  });
});

describe('groupElementsEdit', () => {
  it('writes the new group at the end, its members by full name', () => {
    expect(withoutFrontMatter(applyGroup(`Server a
Server b
`, [server('a'), server('b')], null, 'g1'))).toBe(`Server a
Server b

Group g1 {
  Server a
  Server b
}
`);
  });

  it('groups selected elements inside their common parent', () => {
    const result = applyGroup(`Server a
Server b
Server c
Group outer {
  a
  b
  c
}`, [server('a'), server('b')], 'outer', 'group_1');
    expect(collectDiagnostics(withoutFrontMatter(result))).toEqual([]);
    expect(extractGroups(result)).toEqual({ outer: ['c', 'group_1'], group_1: ['a', 'b'] });
  });

  it('takes a member out of the group that listed it', () => {
    const result = applyGroup(`Server a
Server b
Server c
Group g { a b c }
Group outer {
  g
}`, [server('b')], 'outer', 'group_1');
    expect(collectDiagnostics(withoutFrontMatter(result))).toEqual([]);
    expect(extractGroups(result)).toEqual({ g: ['a', 'c'], outer: ['g', 'group_1'], group_1: ['b'] });
  });

  it('groups two members of one group without touching the block after it', () => {
    const result = applyGroup(`Server application_server
Server web
Group backend { application_server web }
Cache web {}
`, [server('application_server'), server('web')], null, 'group_1');
    expect(result).toContain('Cache web {}');
    expect(extractGroups(result)).toEqual({ backend: [], group_1: ['application_server', 'web'] });
  });

  it('gives no edits when no member is declared', () => {
    expect(createCompiler(`${FRONT_MATTER}Server a`).groupElementsEdit(DEFAULT_ENTRY, [server('b')], null, 'g1')).toEqual([]);
  });
});

describe('ungroupElementsEdit', () => {
  it('removes the group, leaving its members where they are', () => {
    expect(withoutFrontMatter(applyUngroup(`Server a
Server b
Group g { a b }
Server c
`, 'g', [server('a'), server('b')], null))).toBe(`Server a
Server b
Server c
`);
  });

  it('moves the members into the group around it', () => {
    const result = applyUngroup(`Server a
Server b
Server c
Group g { a b }
Group outer {
  g
  c
}
`, 'g', [server('a'), server('b')], 'outer');
    expect(collectDiagnostics(withoutFrontMatter(result))).toEqual([]);
    expect(extractGroups(result)).toEqual({ outer: ['c', 'a', 'b'] });
  });

  it('gives no edits when no group has that handle', () => {
    expect(createCompiler(`${FRONT_MATTER}Server a`).ungroupElementsEdit(DEFAULT_ENTRY, 'g', [server('a')], null)).toEqual([]);
  });
});
