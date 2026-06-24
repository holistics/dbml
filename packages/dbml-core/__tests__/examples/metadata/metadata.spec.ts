import { describe, test, expect, beforeAll } from 'vitest';
import Parser from '../../../src/parse/Parser';
import Database from '../../../src/model_structure/database';

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

Metadata Table public.users {
  owner: 'scott'
  note: 'scott is the owner'
}

Metadata Table public.users {
  note: 'this will override'
  color: #aaa
}

Metadata Column public.users.id {
  pii: true
  masking: 'partial'
}

Metadata TableGroup g1 {
  team: 'data'
}
`;

function parse (dbml: string): Database {
  return (new Parser()).parse(dbml, 'dbmlv2') as unknown as Database;
}

describe('@dbml/core - metadata element', () => {
  let database: Database;

  beforeAll(() => {
    database = parse(DBML);
  });

  test('attaches merged table metadata (last-wins on key conflict)', () => {
    const schema = database.schemas.find((s) => s.name === 'public');
    const users = schema!.tables.find((t) => t.name === 'users');
    expect(users!.metadata).toEqual({
      owner: 'scott',
      note: 'this will override', // second block overrides first
      color: '#aaa',
    });
  });

  test('attaches metadata to a Column', () => {
    const schema = database.schemas.find((s) => s.name === 'public');
    const users = schema!.tables.find((t) => t.name === 'users');
    const idField = users!.fields.find((f) => f.name === 'id');
    expect(idField!.metadata).toEqual({ pii: true, masking: 'partial' });
  });

  test('attaches metadata to a TableGroup', () => {
    const schema = database.schemas.find((s) => s.name === 'public');
    const g1 = schema!.tableGroups.find((tg) => tg.name === 'g1');
    expect(g1!.metadata).toEqual({ team: 'data' });
  });

  test('normalize() exposes merged metadata on each element', () => {
    const model = database.normalize();

    const usersId = Object.values(model.tables).find((t: any) => t.name === 'users')!.id;
    expect(model.tables[usersId].metadata).toEqual({
      owner: 'scott',
      note: 'this will override',
      color: '#aaa',
    });
  });

  test('export() round-trips merged metadata onto tables', () => {
    const out = database.export() as any;
    const publicSchema = out.schemas.find((s: any) => s.name === 'public');
    const users = publicSchema.tables.find((t: any) => t.name === 'users');
    expect(users.metadata).toEqual({
      owner: 'scott',
      note: 'this will override',
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
