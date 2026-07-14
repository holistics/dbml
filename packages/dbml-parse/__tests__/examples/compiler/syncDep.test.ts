import {
  describe, expect, it,
} from 'vitest';
import Compiler from '@/compiler/index';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import type { DepSyncOperation } from '@/compiler/queries/transform/syncDep';
import { interpret } from '@tests/utils';

function syncDep (dbml: string, operations: DepSyncOperation[]) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, dbml);
  const compiler = new Compiler(layout);
  return compiler.syncDep(DEFAULT_ENTRY, operations);
}

const PRELUDE = `
Table a { id int }
Table b { id int }
`;

const tableEdge = (up: string, down: string): DepSyncOperation['edge'] => ({
  upstream: { table: up, fields: [] },
  downstream: { table: down, fields: [] },
});

describe('syncDep - create', () => {
  it('creates a direct Dep block with a color when no block exists (aggregate table-level line)', () => {
    const { newDbml } = syncDep(PRELUDE, [
      { operation: 'create', edge: tableEdge('a', 'b'), color: '#aabbcc' },
    ]);
    expect(newDbml).toContain('Dep [color: #aabbcc] {');
    expect(newDbml).toContain('a -> b');
    // round-trips: color reaches the model
    const db = interpret(newDbml).getValue()!;
    const dep = db.deps.find((d) => d.edges[0].upstream.tableName === 'a' && d.edges[0].downstream.tableName === 'b');
    expect(dep?.color).toBe('#aabbcc');
  });

  it('treats an existing matching block as an update - no duplicate Dep', () => {
    const dbml = `${PRELUDE}
Dep {
  a -> b
}`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'create', edge: tableEdge('a', 'b'), color: '#123456' },
    ]);
    // exactly one Dep block
    expect(newDbml.match(/Dep\s*\{/g)?.length ?? newDbml.match(/Dep\b/g)?.length).toBe(1);
    expect(newDbml).toContain('[color: #123456]');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps).toHaveLength(1);
    expect(db.deps[0].color).toBe('#123456');
  });
});

describe('syncDep - update existing block color', () => {
  it('overwrites a header [color] in place', () => {
    const dbml = `${PRELUDE}
Dep [color: #000000] {
  a -> b
}`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'update', edge: tableEdge('a', 'b'), color: '#ff0000' },
    ]);
    expect(newDbml).toContain('#ff0000');
    expect(newDbml).not.toContain('#000000');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBe('#ff0000');
  });

  it('overwrites a body sub-declaration color in place', () => {
    const dbml = `${PRELUDE}
Dep {
  a -> b
  color: #000000
}`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'update', edge: tableEdge('a', 'b'), color: '#00ff00' },
    ]);
    expect(newDbml).toContain('#00ff00');
    expect(newDbml).not.toContain('#000000');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBe('#00ff00');
  });

  it('overwrites an inline short-form [color] in place', () => {
    const dbml = `${PRELUDE}
Dep: a -> b [color: #000000]`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'update', edge: tableEdge('a', 'b'), color: '#0000ff' },
    ]);
    expect(newDbml).toContain('#0000ff');
    expect(newDbml).not.toContain('#000000');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBe('#0000ff');
  });

  it('adds a [color] to a block that has none', () => {
    const dbml = `${PRELUDE}
Dep {
  a -> b
}`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'update', edge: tableEdge('a', 'b'), color: '#abcdef' },
    ]);
    expect(newDbml).toContain('[color: #abcdef]');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBe('#abcdef');
  });

  it('matches a column-level edge to update its block', () => {
    const dbml = `${PRELUDE}
Dep {
  a.id -> b.id
}`;
    const { newDbml } = syncDep(dbml, [
      {
        operation: 'update',
        edge: {
          upstream: { table: 'a', fields: ['id'] },
          downstream: { table: 'b', fields: ['id'] },
        },
        color: '#abcabc',
      },
    ]);
    expect(newDbml).toContain('[color: #abcabc]');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBe('#abcabc');
  });
});

describe('syncDep - remove existing block color', () => {
  it('removes a sole header [color] together with its [...] list', () => {
    const dbml = `${PRELUDE}
Dep [color: #000000] {
  a -> b
}`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'remove', edge: tableEdge('a', 'b') },
    ]);
    expect(newDbml).not.toContain('color');
    expect(newDbml).not.toContain('[');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBeUndefined();
  });

  it('removes a header [color] but keeps other settings and one comma', () => {
    const dbml = `${PRELUDE}
Dep [note: "x", color: #000000] {
  a -> b
}`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'remove', edge: tableEdge('a', 'b') },
    ]);
    expect(newDbml).not.toContain('color');
    expect(newDbml).toContain('note: "x"');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBeUndefined();
  });

  it('removes a body sub-declaration color', () => {
    const dbml = `${PRELUDE}
Dep {
  a -> b
  color: #000000
}`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'remove', edge: tableEdge('a', 'b') },
    ]);
    expect(newDbml).not.toContain('#000000');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBeUndefined();
  });

  it('removes an inline short-form [color]', () => {
    const dbml = `${PRELUDE}
Dep: a -> b [color: #000000]`;
    const { newDbml } = syncDep(dbml, [
      { operation: 'remove', edge: tableEdge('a', 'b') },
    ]);
    expect(newDbml).not.toContain('color');
    const db = interpret(newDbml).getValue()!;
    expect(db.deps[0].color).toBeUndefined();
  });

  it('is a no-op for an edge with no block', () => {
    const { newDbml, edits } = syncDep(PRELUDE, [
      { operation: 'remove', edge: tableEdge('a', 'b') },
    ]);
    expect(edits).toHaveLength(0);
    expect(newDbml).toBe(PRELUDE);
  });

  it('is a no-op for a block that has no color', () => {
    const dbml = `${PRELUDE}
Dep {
  a -> b
}`;
    const { edits } = syncDep(dbml, [
      { operation: 'remove', edge: tableEdge('a', 'b') },
    ]);
    expect(edits).toHaveLength(0);
  });
});
