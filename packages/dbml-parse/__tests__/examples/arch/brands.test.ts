import { describe, expect, it } from 'vitest';
import { BRAND_ICONS, DRAWN_ICONS, ICON_ALIAS, ICON_NAMES, isIconName, resolveIcon } from '@/core/arch/icons';
import { compileArch, isNode } from './compileArch';

// A `type` this file does not list is nulled by interpret.ts before anything downstream sees it,
// so these names are the whole contract with the renderer: whatever it can draw has to be here,
// and whatever is here has to survive a compile.
describe('the brand vocabulary', () => {
  const typeOf = (name: string) => {
    const { model } = compileArch({
      '/main.arch.dbml': `---\ndiagram_type: arch\n---\nDatabase x [type: '${name}']`,
    });
    const node = [...model.elements.values()].find(isNode);
    return node?.type ?? null;
  };

  it('carries every name exactly once', () => {
    expect(ICON_NAMES.length).toBe(new Set(ICON_NAMES).size);
    expect(DRAWN_ICONS.filter((n) => BRAND_ICONS.includes(n))).toEqual([]);
  });

  it('resolves every alias to a name it holds', () => {
    const missing = Object.entries(ICON_ALIAS).filter(([, to]) => !ICON_NAMES.includes(to));
    expect(missing).toEqual([]);
    expect(Object.keys(ICON_ALIAS).filter((from) => ICON_NAMES.includes(from))).toEqual([]);
  });

  it('hands every brand down to the renderer instead of nulling it', () => {
    const dropped = BRAND_ICONS.filter((name) => typeOf(name) !== name);
    expect(dropped).toEqual([]);
  });

  it('hands an alias down as the name it resolves to', () => {
    expect(typeOf('pg')).toBe('postgres');
    expect(typeOf('k8s')).toBe('kubernetes');
    expect(resolveIcon('mongo')).toBe('mongodb');
  });

  it('still nulls a type it has never heard of', () => {
    expect(isIconName('not-a-product')).toBe(false);
    expect(typeOf('notaproduct')).toBeNull();
  });
});
