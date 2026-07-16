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
  a.id -> b.id
}`);
      expect(result.getValue()?.deps).toHaveLength(1);
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

  describe('complex dep block: exclusive downstream ownership', () => {
    it('errors when two complex blocks target the same downstream', () => {
      const errors = interpret(`${PRELUDE}
Dep { a -> b }
Dep { c -> b }
`).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DEP_DUPLICATE_DOWNSTREAM_TABLE)).toBe(true);
    });

    it('errors when simple dep comes after complex block with same downstream', () => {
      const errors = interpret(`${PRELUDE}
Dep { a -> b }
Dep: c -> b
`).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DEP_DUPLICATE_DOWNSTREAM_TABLE)).toBe(true);
    });

    it('errors when complex block comes after simple dep with same downstream', () => {
      const errors = interpret(`${PRELUDE}
Dep: a -> b
Dep { c -> b }
`).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DEP_DUPLICATE_DOWNSTREAM_TABLE)).toBe(true);
    });

    it('errors when inline dep conflicts with complex block', () => {
      const errors = interpret(`
Table a { id int }
Table b { id int [dep: -> a.id] }
Dep { b -> a }
`).getErrors();
      expect(errors.some((e) => e.code === CompileErrorCode.DEP_DUPLICATE_DOWNSTREAM_TABLE)).toBe(true);
    });
  });

  describe('simple/inline deps: no restriction among themselves', () => {
    it('allows multiple simple deps targeting the same downstream', () => {
      const result = interpret(`${PRELUDE}
Dep: a -> b
Dep: c -> b
`);
      expect(result.getErrors()).toHaveLength(0);
      expect(result.getValue()?.deps).toHaveLength(2);
    });

    it('allows inline dep and simple dep targeting the same downstream', () => {
      const result = interpret(`
Table a { id int }
Table b { id int [dep: -> a.id] }
Dep: b -> a
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
