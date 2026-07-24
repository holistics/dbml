import { describe, expect, it } from 'vitest';
import { interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/types/errors';

const PRELUDE = `
Table a { id int }
Table b { id int }
Table c { id int }
`;

describe('dep downstream table constraints', () => {
  describe('complex dep block: single downstream table', () => {
    it('allows all edges targeting the same downstream table', () => {
      const result = interpret(`${PRELUDE}
Dep {
  a -> b
  c -> b
}`);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getValue()?.deps).toHaveLength(1);
    });

    it('errors when block mixes table-level and column-level edges', () => {
      const errors = interpret(`${PRELUDE}
Dep {
  a -> b
  a.id -> b.id
}`).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DEP_MIXED_LEVEL)).toBe(true);
    });

    it('errors when edges target different downstream tables', () => {
      const errors = interpret(`${PRELUDE}
Dep {
  a -> b
  a -> c
}`).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DEP_MIXED_DOWNSTREAM_TABLES)).toBe(true);
    });
  });

  describe('mixed-level edges', () => {
    it('allows a table-level upstream with a column-level downstream', () => {
      const result = interpret(`${PRELUDE}
Dep: a -> b.id
`);
      expect(result.getErrors()).toHaveLength(0);
      const edge = result.getValue()?.deps?.[0]?.edges?.[0];
      expect(edge?.upstream.fieldNames).toEqual([]);
      expect(edge?.downstream.fieldNames).toEqual(['id']);
    });

    it('allows a column-level upstream with a table-level downstream', () => {
      const result = interpret(`${PRELUDE}
Dep: a.id -> b
`);
      expect(result.getErrors()).toHaveLength(0);
      const edge = result.getValue()?.deps?.[0]?.edges?.[0];
      expect(edge?.upstream.fieldNames).toEqual(['id']);
      expect(edge?.downstream.fieldNames).toEqual([]);
    });

    it('allows a column feeding its own table', () => {
      const result = interpret(`${PRELUDE}
Dep: a.id -> a
`);
      expect(result.getErrors()).toHaveLength(0);
    });

    it('allows a table depending on itself', () => {
      const result = interpret(`${PRELUDE}
Dep: a -> a
`);
      expect(result.getErrors()).toHaveLength(0);
    });

    it('still errors when a column depends on itself', () => {
      const errors = interpret(`${PRELUDE}
Dep: a.id -> a.id
`).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DEP_SELF_LOOP)).toBe(true);
    });

    it('allows mixed and column edges in one block (both column-level)', () => {
      const result = interpret(`${PRELUDE}
Dep {
  a -> b.id
  a.id -> b.id
}`);
      expect(result.getErrors()).toHaveLength(0);
    });

    it('errors when a block mixes a table-level edge with a mixed edge', () => {
      const errors = interpret(`${PRELUDE}
Dep {
  a -> b
  a -> b.id
}`).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DEP_MIXED_LEVEL)).toBe(true);
    });
  });

  describe('no cross-block restriction on downstream tables', () => {
    it('allows multiple simple deps targeting the same downstream', () => {
      const result = interpret(`${PRELUDE}
Dep: a -> b
Dep: c -> b
`);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getValue()?.deps).toHaveLength(2);
    });

    it('allows two complex blocks targeting the same downstream', () => {
      const result = interpret(`${PRELUDE}
Dep { a -> b }
Dep { c -> b }
`);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getValue()?.deps).toHaveLength(2);
    });

    it('allows simple dep alongside complex block with same downstream', () => {
      const result = interpret(`${PRELUDE}
Dep { a -> b }
Dep: c -> b
`);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getValue()?.deps).toHaveLength(2);
    });

    it('allows inline dep alongside complex block with same downstream', () => {
      const result = interpret(`
Table a { id int }
Table b { id int [dep: -> a.id] }
Dep { b -> a }
`);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getValue()?.deps).toHaveLength(2);
    });

    it('allows complex block alongside simple deps with different downstream', () => {
      const result = interpret(`${PRELUDE}
Dep { a -> b }
Dep: a -> c
`);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getValue()?.deps).toHaveLength(2);
    });
  });
});
