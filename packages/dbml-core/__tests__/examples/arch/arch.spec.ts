import { describe, expect, test } from 'vitest';
import {
  BOOK_FILE, EXAMPLE_ENTRY, EXAMPLE_FILES, INLINE_FILE, SELF_FILE, compileArch,
} from '@dbml/arch';
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

  // @dbml/arch's own compiler reads the same sample, so the two models are compared element by element
  test.each(Object.entries(samples))('%s sample normalizes to what @dbml/arch draws', (_name, { files, entry }) => {
    const model = normalizeProject(files, entry);
    const arch = compileArch(files, entry).model;
    const elements = [...arch.elements.values()];

    const nodes = Object.values(model.nodes ?? {});
    const groups = Object.values(model.groups ?? {});
    const noteBoxes = Object.values(model.noteBoxes ?? {});
    expect(nodes.map(handleOf).sort()).toEqual(elements.filter((e) => e.sort === 'node').map((e) => e.id).sort());
    expect(groups.map(handleOf).sort()).toEqual(elements.filter((e) => e.sort === 'group').map((e) => e.id).sort());
    expect(noteBoxes.map(handleOf).sort()).toEqual(elements.filter((e) => e.sort === 'note').map((e) => e.id).sort());
    expect(Object.keys(model.links ?? {})).toHaveLength(arch.links.length);

    const byId = new Map([...nodes, ...groups, ...noteBoxes].map((e) => [e.id, handleOf(e)]));
    for (const node of nodes) {
      const drawn = arch.elements.get(handleOf(node));
      expect(model.kinds![node.kindId!].name).toBe(drawn?.sort === 'node' && drawn.kind);
    }
    for (const group of groups) {
      const drawn = arch.elements.get(handleOf(group));
      expect(group.childIds.map((id) => byId.get(id))).toEqual(drawn?.sort === 'group' && drawn.children);
    }
    expect(Object.values(model.links ?? {}).map((l) => [byId.get(l.fromId), byId.get(l.toId), l.op]))
      .toEqual(arch.links.map((l) => [l.from, l.to, l.op]));
    expect(model.database[1].diagramType).toBe('arch');
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

  test('a group owns a node and a note box, by id, and export carries all three', () => {
    const parser = new Parser();
    parser.setDbmlSource('/d.dbml', "Server api\nNote memo { 'hello' }\nGroup g { api memo }");
    const database = parser.parseDbmlProject('/d.dbml');
    const model = database.normalize();

    const [node] = Object.values(model.nodes!);
    const [box] = Object.values(model.noteBoxes!);
    const [group] = Object.values(model.groups!);
    expect(group.childIds).toEqual([node.id, box.id]);
    expect(node.groupId).toBe(group.id);
    expect(box).toMatchObject({ name: 'memo', content: 'hello', groupId: group.id });
    expect(group.groupId).toBeNull();

    const exported = database.export() as Record<string, unknown[]>;
    expect(exported.nodes).toHaveLength(1);
    expect(exported.groups).toHaveLength(1);
    expect(exported.noteBoxes).toHaveLength(1);
  });

  test('a DBML file normalizes and exports with no architecture keys', () => {
    const model = normalizeProject({ '/main.dbml': 'Table users {\n  id int [pk]\n}' }, '/main.dbml');
    expect(Object.keys(model)).not.toContain('nodes');
    expect(Object.keys(model.database[1])).not.toContain('diagramType');
    const single = (new Parser()).parse('Table users {\n  id int [pk]\n}', 'dbmlv2').normalize();
    expect(DbmlExporter.export(model, { includeRecords: true })).toBe(DbmlExporter.export(single, { includeRecords: true }));
  });
});
