import path from 'path';
import { describe, expect, test } from 'vitest';
import {
  BOOK_FILE, EXAMPLE_ENTRY, EXAMPLE_FILES, INLINE_FILE, SELF_FILE,
} from './samples';
import Parser from '../../../src/parse/Parser';
import DbmlExporter from '../../../src/export/DbmlExporter';
import type { NormalizedModel } from '../../../types/model_structure/database';

function normalizeProject (files: Record<string, string>, entry: string): NormalizedModel {
  const parser = new Parser();
  for (const [path, source] of Object.entries(files)) parser.setDbmlSource(path, source);
  return parser.parseDbmlProject(entry).normalize();
}

const handleOf = (e: { alias: string | null; name: string }) => e.alias ?? e.name;

describe('@dbml/core - architecture files', () => {
  const samples: Record<string, { files: Record<string, string>; entry: string }> = {
    inline: { files: { '/d.dbml': INLINE_FILE }, entry: '/d.dbml' },
    self: { files: { '/self.dbml': SELF_FILE }, entry: '/self.dbml' },
    book: { files: { '/book.dbml': BOOK_FILE }, entry: '/book.dbml' },
    estate: { files: EXAMPLE_FILES, entry: EXAMPLE_ENTRY },
  };

  // Elements are listed by handle, so the saved output does not change when ids are numbered differently
  test.each(Object.entries(samples))('%s sample normalizes to the saved elements', async (name, { files, entry }) => {
    const model = normalizeProject(files, entry);
    const nodes = Object.values(model.nodes ?? {});
    const groups = Object.values(model.groups ?? {});
    const notes = Object.values(model.notes ?? {});
    // Ids are counted per type, so an element is found by its type and id
    const byRef = new Map([
      ...nodes.map((e) => [`node:${e.id}`, handleOf(e)]),
      ...groups.map((e) => [`group:${e.id}`, handleOf(e)]),
      ...notes.map((e) => [`note:${e.id}`, e.name]),
    ] as [string, string][]);
    const at = (type: string, id: number) => byRef.get(`${type}:${id}`);

    const summary = {
      diagramType: model.database[1].diagramType,
      nodes: nodes.map((node) => [handleOf(node), model.kinds![node.kindId!].name]),
      groups: groups.map((group) => [handleOf(group), group.childIds.map((id, i) => at(group.childTypes[i]!, id))]),
      notes: notes.map((note) => note.name),
      links: Object.values(model.links ?? {}).map((l) => [at(l.fromType, l.fromId), at(l.toType, l.toId), l.op]),
    };
    await expect(JSON.stringify(summary, null, 2)).toMatchFileSnapshot(path.resolve(__dirname, `${name}.out.json`));
  });

  test('a DBML file and an architecture file import each other, each read as its own kind', () => {
    const files = {
      '/schema.dbml': 'Table users {\n  id int [pk]\n}',
      '/infra.dbml': "use * from './schema'\nServer api\nDatabase main { type: 'postgres' }\nLink: api > main",
      '/report.dbml': "use * from './infra'\nTable reports {\n  id int [pk]\n}",
    };

    const infra = normalizeProject(files, '/infra.dbml');
    expect(infra.database[1].diagramType).toBe('arch');
    expect(Object.values(infra.nodes!).map(handleOf)).toEqual(['api', 'main']);
    expect(Object.values(infra.links!)).toHaveLength(1);
    expect(Object.values(infra.tables).map((t) => t.name)).toEqual(['users']);

    const report = normalizeProject(files, '/report.dbml');
    expect(report.database[1].diagramType).toBeUndefined();
    expect(Object.values(report.tables).map((t) => t.name)).toEqual(['reports']);
    expect(Object.values(report.nodes!).map(handleOf)).toEqual(['api', 'main']);
  });

  test('a group owns a node and a sticky note, by type and id, and export carries all three', () => {
    const parser = new Parser();
    parser.setDbmlSource('/d.dbml', "Server api\nNote memo { 'hello' }\nGroup g { api memo }");
    const database = parser.parseDbmlProject('/d.dbml');
    const model = database.normalize();

    const [node] = Object.values(model.nodes!);
    const [note] = Object.values(model.notes);
    const [group] = Object.values(model.groups!);
    expect(group.childIds).toEqual([node.id, note.id]);
    expect(group.childTypes).toEqual(['node', 'note']);
    expect(node.groupId).toBe(group.id);
    expect(note).toMatchObject({ name: 'memo', content: 'hello' });
    expect(note).not.toHaveProperty('groupId');
    expect(group.groupId).toBeNull();

    const exported = database.export() as Record<string, unknown[]>;
    expect(exported.nodes).toHaveLength(1);
    expect(exported.groups).toHaveLength(1);
    expect(exported.notes).toHaveLength(1);
  });

  test('a link to a sticky note names it by type, and ids are counted per type', () => {
    const model = normalizeProject({ '/d.dbml': "Server api\nGroup g { api }\nNote memo { 'x' }\nLink: api > memo\nLink: g - api" }, '/d.dbml');
    const [node] = Object.values(model.nodes!);
    const [group] = Object.values(model.groups!);
    const [note] = Object.values(model.notes);
    expect([node.id, group.id, note.id]).toEqual([1, 1, 1]);
    expect(Object.values(model.links!).map((l) => [l.fromType, l.fromId, l.toType, l.toId])).toEqual([
      ['node', node.id, 'note', note.id],
      ['group', group.id, 'node', node.id],
    ]);
  });

  test('sticky note ids in a DBML-only file are unchanged', () => {
    const model = normalizeProject({ '/d.dbml': "Table users {\n  id int\n}\nNote a { 'x' }\nNote b { 'y' }" }, '/d.dbml');
    expect(Object.values(model.notes).map((n) => [n.id, n.name])).toEqual([[1, 'a'], [2, 'b']]);
  });

  test('an inline link normalizes like a Link: its ends become the two elements\' ids', () => {
    const model = normalizeProject({ '/d.dbml': 'Server api [link: > main]\nDatabase main' }, '/d.dbml');
    const [api, main] = Object.values(model.nodes!);
    const [link] = Object.values(model.links!);
    expect(link).toMatchObject({ fromId: api.id, toId: main.id, op: '>' });
    expect(api.settings).toEqual({});
  });

  test('a DBML file normalizes and exports with no architecture keys', () => {
    const model = normalizeProject({ '/main.dbml': 'Table users {\n  id int [pk]\n}' }, '/main.dbml');
    expect(Object.keys(model)).not.toContain('nodes');
    expect(Object.keys(model.database[1])).not.toContain('diagramType');
    const single = (new Parser()).parse('Table users {\n  id int [pk]\n}', 'dbmlv2').normalize();
    expect(DbmlExporter.export(model, { includeRecords: true })).toBe(DbmlExporter.export(single, { includeRecords: true }));
  });
});
