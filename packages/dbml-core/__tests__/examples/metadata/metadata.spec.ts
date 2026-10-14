import { describe, test, expect, beforeAll } from 'vitest';
import Parser from '../../../src/parse/Parser';
import Database from '../../../src/model_structure/database';
import exporter from '../../../src/export';
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
  pii: 'true'
  masking: 'partial'
}

Metadata TableGroup g1 {
  team: 'data'
  color: #aaa
}
`;

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
    expect(users!.metadata).toEqual({
      owner: 'scott',
      color: '#aaa',
    });
  });

  test('attaches metadata to a Column', () => {
    const schema = database.schemas.find((s) => s.name === 'public');
    const users = schema!.tables.find((t) => t.name === 'users');
    const idField = users!.fields.find((f) => f.name === 'id');
    expect(idField!.metadata).toEqual({ pii: 'true', masking: 'partial' });
  });

  test('attaches metadata to a TableGroup', () => {
    const schema = database.schemas.find((s) => s.name === 'public');
    const g1 = schema!.tableGroups.find((tg) => tg.name === 'g1');
    expect(g1!.metadata).toEqual({ team: 'data' });
  });

  test('normalize() exposes merged metadata on each element', () => {
    const model = database.normalize();

    const usersId = (Object.values(model.tables).find((t: any) => t.name === 'users')! as Table).id;
    expect(model.tables[usersId]?.note).toBe('this will override');
    expect(model.tables[usersId].metadata).toEqual({
      owner: 'scott',
      color: '#aaa',
    });
  });

  test('export() round-trips merged metadata onto tables', () => {
    const out = database.export() as any;
    const publicSchema = out.schemas.find((s: any) => s.name === 'public');
    const users = publicSchema.tables.find((t: any) => t.name === 'users');
    expect(users.note).toBe('this will override');
    expect(users.metadata).toEqual({
      owner: 'scott',
      color: '#aaa',
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

  const database = (new Parser()).parse(dbml, 'dbmlv2');
  const users = database.schemas[0].tables[0];
  expect(users.metadata).toEqual({
    count: 42, ratio: 1.5, active: false, owner: 'scott',
  });
  expect(users.fields[0].metadata).toEqual({ rank: 3, pii: true });

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
  const reparsed = (new Parser()).parse(out, 'dbmlv2');
  expect(reparsed.schemas[0].tables[0].metadata).toEqual(users.metadata);
  expect(reparsed.schemas[0].tables[0].fields[0].metadata).toEqual({ rank: 3, pii: true });
});
