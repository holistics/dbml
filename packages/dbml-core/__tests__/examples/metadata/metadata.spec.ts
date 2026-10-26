import { describe, test, expect, beforeAll } from 'vitest';
import Parser from '../../../src/parse/Parser';
import Database from '../../../src/model_structure/database';
import exporter from '../../../src/export';
import type { CustomMetadata } from '@dbml/parse';
import { Table } from '../../../types/model_structure';

const DBML = `
Table users {
  id int [pk]
  name varchar
}

Table sales.orders {
  id int [pk]
}

TableGroup g1 {
  users
}

Metadata Table users {
  owner: 'scott'
  note: 'scott is the owner'
}

Metadata Table users {
  note: 'this will override'
  color: #aaa
}

Metadata Column users.id {
  pii: true
  masking: 'partial'
}

Metadata TableGroup g1 {
  team: 'data'
  color: #aaa
}
`;

// Strip metadata entries ({ value, type, token }) down to their values
function excludeMetadataValueToken (metadata?: CustomMetadata) {
  return metadata && Object.fromEntries(Object.entries(metadata).map(([key, entry]) => [key, { value: entry.value, type: entry.type }]));
}

function parse (dbml: string): Database {
  return (new Parser()).parse(dbml, 'dbmlv2');
}

describe('@dbml/core - metadata element', () => {
  let database: Database;

  beforeAll(() => {
    database = parse(DBML);
  });

  test('attaches merged table metadata', () => {
    const schema = database.schemas.find((s) => s.name === 'public');
    const users = schema!.tables.find((t) => t.name === 'users');
    expect(users?.note).toBe('this will override');
    expect(excludeMetadataValueToken(users!.metadata)).toEqual({
      owner: { value: 'scott', type: 'string' },
      color: { value: '#aaa', type: 'color' },
    });
  });

  test('attaches metadata to a Column', () => {
    const schema = database.schemas.find((s) => s.name === 'public');
    const users = schema!.tables.find((t) => t.name === 'users');
    const idField = users!.fields.find((f) => f.name === 'id');
    expect(excludeMetadataValueToken(idField!.metadata)).toEqual({
      pii: { value: true, type: 'bool' },
      masking: { value: 'partial', type: 'string' },
    });
  });

  test('attaches metadata to a TableGroup', () => {
    const schema = database.schemas.find((s) => s.name === 'public');
    const g1 = schema!.tableGroups.find((tg) => tg.name === 'g1');
    expect(excludeMetadataValueToken(g1!.metadata)).toEqual({
      team: { value: 'data', type: 'string' },
    });
  });

  test('normalize() exposes merged metadata on each element', () => {
    const model = database.normalize();

    const usersId = (Object.values(model.tables).find((t: any) => t.name === 'users')! as Table).id;
    expect(model.tables[usersId]?.note).toBe('this will override');
    expect(excludeMetadataValueToken(model.tables[usersId].metadata)).toEqual({
      owner: { value: 'scott', type: 'string' },
      color: { value: '#aaa', type: 'color' },
    });
  });

  test('export() round-trips merged metadata onto tables', () => {
    const out = database.export() as any;
    const publicSchema = out.schemas.find((s: any) => s.name === 'public');
    const users = publicSchema.tables.find((t: any) => t.name === 'users');
    expect(users.note).toBe('this will override');
    expect(excludeMetadataValueToken(users.metadata)).toEqual({
      owner: { value: 'scott', type: 'string' },
      color: { value: '#aaa', type: 'color' },
    });
  });

  test('throws when metadata targets a non-existent element', () => {
    expect(() => parse(`
      Table users { id int }
      Metadata Table public.ghost { owner: 'x' }
    `)).toThrow();
  });
});

const METADATA_DBML = `
Table users {
  id int [pk]
  name varchar
}

TableGroup g1 {
  users
}

Note overview {
  'a top-level note'
}

Metadata Table users {
  owner: 'scott'
  note: 'promoted, not custom'
  headercolor: #123456
}

Metadata Column users.id {
  pii: 'true'
  masking: 'partial'
}

Metadata TableGroup g1 {
  team: 'data'
  color: #aaa
}

Metadata Note overview {
  author: 'docs'
}
`.trim();

test('@dbml/core - exporter metadata blocks', () => {
  const out = exporter.export(METADATA_DBML, 'dbml');
  expect(out).toEqual(`Table "users" [headerColor: #123456] {
  "id" int [pk]
  "name" varchar
  Note: 'promoted, not custom'
}

TableGroup "g1" [color: #aaa] {
  "users"
}

Note overview {
  'a top-level note'
}

Metadata Table "users" {
  owner: 'scott'
}

Metadata Column "users"."id" {
  pii: 'true'
  masking: 'partial'
}

Metadata TableGroup "g1" {
  team: 'data'
}

Metadata Note overview {
  author: 'docs'
}
`)
});

test('@dbml/core - exporter metadata blocks with number and boolean values', () => {
  const dbml = `
Table users {
  id int [pk, rank: 3, pii: true]
}

Metadata Table users {
  count: 42
  ratio: 1.5
  active: false
  owner: 'scott'
}
`.trim();

  const database = parse(dbml)

  const users = database.schemas[0].tables[0];
  expect(excludeMetadataValueToken(users.metadata)).toEqual({
    count: { value: 42, type: 'number' },
    ratio: { value: 1.5, type: 'number' },
    active: { value: false, type: 'bool' },
    owner: { value: 'scott', type: 'string' },
  });
  expect(excludeMetadataValueToken(users.fields[0].metadata)).toEqual({
    rank: { value: 3, type: 'number' },
    pii: { value: true, type: 'bool' },
  });

  const out = exporter.export(dbml, 'dbml');
  expect(out).toContain(`Metadata Table "users" {
  count: 42
  ratio: 1.5
  active: false
  owner: 'scott'
}`);
  expect(out).toContain(`Metadata Column "users"."id" {
  rank: 3
  pii: true
}`);

  // Exported DBML re-parses to the same typed values
  const reparsed = parse(out)
  expect(excludeMetadataValueToken(reparsed.schemas[0].tables[0].metadata)).toEqual(excludeMetadataValueToken(users.metadata));
  expect(excludeMetadataValueToken(reparsed.schemas[0].tables[0].fields[0].metadata)).toEqual({
    rank: { value: 3, type: 'number' },
    pii: { value: true, type: 'bool' },
  });
});

test('@dbml/core - exporter metadata blocks with signed number values', () => {
  const dbml = `
Table users {
  id int [rank: -3, weight: +2]
}

Metadata Table users {
  offset: -1
  boost: +5
  delta: -1.5
}
`.trim();

  const database = parse(dbml)
  const users = database.schemas[0].tables[0];
  expect(excludeMetadataValueToken(users.metadata)).toEqual({
    offset: { value: -1, type: 'number' },
    boost: { value: 5, type: 'number' },
    delta: { value: -1.5, type: 'number' },
  });
  expect(excludeMetadataValueToken(users.fields[0].metadata)).toEqual({
    rank: { value: -3, type: 'number' },
    weight: { value: 2, type: 'number' },
  });

  // A redundant `+` is not preserved: values are exported as plain numbers
  const out = exporter.export(dbml, 'dbml');
  expect(out).toContain(`Metadata Table "users" {
  offset: -1
  boost: 5
  delta: -1.5
}`);
  expect(out).toContain(`Metadata Column "users"."id" {
  rank: -3
  weight: 2
}`);

  const reparsed = parse(out)
  expect(excludeMetadataValueToken(reparsed.schemas[0].tables[0].metadata)).toEqual(excludeMetadataValueToken(users.metadata));
  expect(excludeMetadataValueToken(reparsed.schemas[0].tables[0].fields[0].metadata)).toEqual({
    rank: { value: -3, type: 'number' },
    weight: { value: 2, type: 'number' },
  });
});

test('@dbml/core - exporter metadata blocks keep color values unquoted', () => {
  const dbml = `
Table users {
  id int [accent: #abc]
}

Metadata Table users {
  accent: #00ff00
  label: '#00ff00'
}
`.trim();

  const database = parse(dbml)
  const users = database.schemas[0].tables[0];
  expect(users.metadata.accent).toMatchObject({ value: '#00ff00', type: 'color' });
  expect(users.metadata.label).toMatchObject({ value: '#00ff00', type: 'string' });

  const out = exporter.export(dbml, 'dbml');
  expect(out).toContain(`Metadata Table "users" {
  accent: #00ff00
  label: '#00ff00'
}`);
  expect(out).toContain(`Metadata Column "users"."id" {
  accent: #abc
}`);

  const reparsed = parse(out).schemas[0].tables[0];
  expect(reparsed.metadata.accent).toMatchObject({ value: '#00ff00', type: 'color' });
  expect(reparsed.metadata.label).toMatchObject({ value: '#00ff00', type: 'string' });
});
