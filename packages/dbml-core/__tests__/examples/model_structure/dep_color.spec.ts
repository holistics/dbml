import Parser from '../../../src/parse/Parser';
import { test, describe, expect } from 'vitest';

const dbml = `
Table users { id int }
Table orders { id int }
Table events { id int }
Table reports { id int }

// header attribute form
Dep dep_header [color: #aabbcc] {
  users -> orders
}

// body sub-declaration form
Dep dep_body {
  orders -> events
  color: #123456
}

// short / inline-setting form
Dep: users -> reports [color: #abcdef]

// uncolored
Dep: events -> users
`;

describe('@dbml/core - Dep color (first-class setting)', () => {
  const database = (new Parser()).parse(dbml, 'dbmlv2');
  const deps = database.schemas[0].deps;

  const byName = (name: string) => deps.find((d) => d.name === name)!;
  const byEdge = (up: string, down: string) =>
    deps.find((d) => d.edges[0].upstream.tableName === up && d.edges[0].downstream.tableName === down)!;

  test('[color] in the header attribute list parses into dep.color', () => {
    expect(byName('dep_header').color).toBe('#aabbcc');
  });

  test('color in a body sub-declaration parses into dep.color', () => {
    expect(byName('dep_body').color).toBe('#123456');
  });

  test('[color] on a short-form Dep parses into dep.color', () => {
    expect(byEdge('users', 'reports').color).toBe('#abcdef');
  });

  test('an uncolored Dep has no color', () => {
    expect(byEdge('events', 'users').color).toBeUndefined();
  });

  test('color appears on the normalized dep', () => {
    const model = database.normalize();
    const colors = Object.values(model.deps)
      .map((d: any) => d.color)
      .filter(Boolean)
      .sort();
    expect(colors).toEqual(['#123456', '#aabbcc', '#abcdef']);
  });
});
