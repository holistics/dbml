import { describe, expect, it } from 'vitest';
import { interpret } from '@tests/utils';

const PRELUDE = `
Table a { id int }
Table b { id int }
`;

function getDepNote (dbml: string): string | undefined {
  const db = interpret(dbml).getValue();
  return db?.deps?.[0]?.note?.value;
}

describe('dep note interpretation', () => {
  it('reads Note sub-element inside body (capitalized)', () => {
    const note = getDepNote(`${PRELUDE}
Dep {
  a -> b
  Note: 'hello'
}`);
    expect(note).toBe('hello');
  });

  it('reads note sub-declaration inside body (lowercase)', () => {
    const note = getDepNote(`${PRELUDE}
Dep {
  a -> b
  note: 'hello'
}`);
    expect(note).toBe('hello');
  });

  it('reads note from header setting list', () => {
    const note = getDepNote(`${PRELUDE}
Dep [note: 'from header'] {
  a -> b
}`);
    expect(note).toBe('from header');
  });

  it('reads note from short-form setting list', () => {
    const note = getDepNote(`${PRELUDE}
Dep: a -> b [note: 'short']`);
    expect(note).toBe('short');
  });

  it('body note overrides header note (last-write-wins)', () => {
    const note = getDepNote(`${PRELUDE}
Dep [note: 'header'] {
  a -> b
  note: 'body'
}`);
    expect(note).toBe('body');
  });

  it('reads color sub-declaration inside body (lowercase)', () => {
    const db = interpret(`${PRELUDE}
Dep {
  a -> b
  color: #aabbcc
}`).getValue();
    expect(db?.deps?.[0]?.color).toBe('#aabbcc');
  });

  it('reads Color sub-declaration inside body (capitalized)', () => {
    const db = interpret(`${PRELUDE}
Dep {
  a -> b
  Color: #aabbcc
}`).getValue();
    expect(db?.deps?.[0]?.color).toBe('#aabbcc');
  });

  it('case insensitive: NOTE in body', () => {
    const note = getDepNote(`${PRELUDE}
Dep {
  a -> b
  NOTE: 'loud'
}`);
    expect(note).toBe('loud');
  });

  it('note with column-level edges', () => {
    const note = getDepNote(`${PRELUDE}
Dep {
  a.id -> b.id
  note: 'with columns'
}`);
    expect(note).toBe('with columns');
  });

  it('Note block form inside body', () => {
    const note = getDepNote(`${PRELUDE}
Dep {
  a -> b
  Note {
    'block form'
  }
}`);
    expect(note).toBe('block form');
  });
});
