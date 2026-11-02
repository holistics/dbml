import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, expect, it } from 'vitest';
import { SUPPORTED_TYPES, TYPE_ALIAS, resolveType } from '@/core/arch/icons';
import { compileArch, isNode } from './compileArch';

const DOC = readFileSync(resolve(__dirname, '../../../../../dbml-homepage/docs/syntax/architecture-diagrams.md'), 'utf8');

function compileNode (settings: string) {
  const { model, diagnostics } = compileArch({
    '/main.arch.dbml': `Project {\n  diagram_type: 'arch'\n}\nDatabase x [${settings}]`,
  });
  return { node: [...model.elements.values()].find(isNode), diagnostics };
}

const typeOf = (value: string) => compileNode(`type: '${value}'`).node?.type ?? null;

describe('[example] supported types', () => {
  it('are the values the syntax doc lists, in its order', () => {
    const section = DOC.slice(DOC.indexOf('## Supported Types'));
    const listed = (section.match(/```text\n([\s\S]*?)```/)?.[1] ?? '').split(/\s+/).filter(Boolean);
    expect(listed).toEqual(SUPPORTED_TYPES);
    expect(SUPPORTED_TYPES).toHaveLength(138);
  });

  it('take the alternative values the syntax doc lists', () => {
    const section = DOC.slice(DOC.indexOf('These alternative values'));
    const rows = section.split('\n').filter((line) => /^\| `/.test(line));
    const listed = Object.fromEntries(rows.flatMap((line) => {
      const [, from, to] = line.split('|');
      const target = to.match(/`(\w+)`/)![1];
      return [...from.matchAll(/`(\w+)`/g)].map((m) => [m[1], target]);
    }));
    expect(listed).toEqual(TYPE_ALIAS);
    expect(Object.keys(TYPE_ALIAS)).toHaveLength(22);
  });

  it('reach the model as the listed value, in any case and through an alternative', () => {
    expect(SUPPORTED_TYPES.filter((name) => typeOf(name) !== name)).toEqual([]);
    expect(typeOf('Postgres')).toBe('postgres');
    expect(typeOf('PostgreSQL')).toBe('postgres');
    expect(typeOf('k8s')).toBe('kubernetes');
    expect(resolveType('MONGO')).toBe('mongodb');
  });

  it('an unknown value, a role icon name or a generic word is not a type, and warns', () => {
    for (const value of ['notaproduct', 'server', 'cache', 'cdn', 'user']) {
      const { node, diagnostics } = compileNode(`type: '${value}'`);
      expect(node?.type).toBeNull();
      expect(diagnostics.map((d) => d.code)).toEqual(['unknown-type']);
    }
    expect(compileNode("type: 'postgress'").diagnostics[0].message).toBe('There is no type called postgress. Did you mean: postgres, postgresql?');
  });
});

describe('[example] node icon', () => {
  it('icon takes an https or data:image URL, and the type is still recorded', () => {
    const { node, diagnostics } = compileNode("type: 'airbyte', icon: 'https://example.com/airbyte.png'");
    expect(diagnostics).toEqual([]);
    expect(node?.type).toBe('airbyte');
    expect(node?.icon).toBe('https://example.com/airbyte.png');
    expect(compileNode("icon: 'data:image/png;base64,iVBORw0KGgo='").node?.icon).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  it('any other icon value is ignored without a message', () => {
    for (const value of ['http://example.com/a.png', 'javascript:alert(1)', 'lock', 'postgres']) {
      const { node, diagnostics } = compileNode(`icon: '${value}'`);
      expect(node?.icon).toBeNull();
      expect(diagnostics).toEqual([]);
    }
  });

  it('a picture URL in type is not a picture', () => {
    const { node, diagnostics } = compileNode("type: 'https://example.com/acme.svg'");
    expect(node?.icon).toBeNull();
    expect(node?.type).toBeNull();
    expect(diagnostics.map((d) => d.code)).toEqual(['unknown-type']);
  });
});
