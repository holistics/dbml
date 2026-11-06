import { describe, expect, it } from 'vitest';
import { analyze, interpret } from '@tests/utils';
import { CompileErrorCode } from '@/core/types/errors';

describe('empty table validation', () => {
  it('raises EMPTY_TABLE error for a table with no columns', () => {
    const errors = interpret('Table empty_table {}').getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.EMPTY_TABLE)).toBe(true);
  });

  it('no error for a table with at least one column', () => {
    const errors = interpret('Table t { id int }').getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.EMPTY_TABLE)).toBe(false);
  });
});

describe('duplicate index column validation', () => {
  it('raises DUPLICATE_INDEX_COLUMN for a tuple index with repeated column', () => {
    const errors = analyze(`
Table t {
  id int [pk]
  name varchar
  indexes {
    (id, id)
  }
}`).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_INDEX_COLUMN)).toBe(true);
  });

  it('no error for index tuple with unique columns', () => {
    const errors = analyze(`
Table t {
  id int [pk]
  name varchar
  indexes {
    (id, name)
  }
}`).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_INDEX_COLUMN)).toBe(false);
  });

  it('raises DUPLICATE_INDEX_COLUMN with three columns where one repeats', () => {
    const errors = analyze(`
Table t {
  id int [pk]
  name varchar
  age int
  indexes {
    (id, name, id)
  }
}`).getErrors();
    expect(errors.some((e) => e.code === CompileErrorCode.DUPLICATE_INDEX_COLUMN)).toBe(true);
  });
});
