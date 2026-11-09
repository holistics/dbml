import { describe, expect, it } from 'vitest';
import { SUPPORTED_ARCH_TYPES, resolveArchType } from '@/core/arch/icons';
import { compileArch, isNode } from './compileArch';

function compileNode (settings: string) {
  const { model, diagnostics } = compileArch({
    '/main.arch.dbml': `---\ndiagram_type: arch\n---\nDatabase x [${settings}]`,
  });
  return { node: [...model.elements.values()].find(isNode), diagnostics };
}

const resolveType = (value: string) => compileNode(`type: '${value}'`).node?.type ?? null;

describe('[example] supported types', () => {
  it('reach the model as the listed value, in any case and through an alternative', () => {
    expect(SUPPORTED_ARCH_TYPES.filter((name) => resolveType(name) !== name)).toEqual([]);
    expect(resolveType('Postgres')).toBe('postgres');
    expect(resolveType('PostgreSQL')).toBe('postgres');
    expect(resolveType('k8s')).toBe('kubernetes');
    expect(resolveArchType('MONGO')).toBe('mongodb');
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
