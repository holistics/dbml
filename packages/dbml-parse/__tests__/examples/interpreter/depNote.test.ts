import { describe, expect, it } from 'vitest';
import { interpret, analyze } from '@tests/utils';

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

describe('dep settings validation', () => {
  it('valid: color in setting list', () => {
    const errors = analyze(`${PRELUDE}Dep: a -> b [color: #aabbcc]`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: note in setting list', () => {
    const errors = analyze(`${PRELUDE}Dep: a -> b [note: 'hello']`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: custom string setting', () => {
    const errors = analyze(`${PRELUDE}Dep: a -> b [owner: 'data-team']`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: custom identifier setting', () => {
    const errors = analyze(`${PRELUDE}Dep [materialized: view] { a -> b }`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: custom numeric setting', () => {
    const errors = analyze(`${PRELUDE}Dep [priority: 1] { a -> b }`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: custom color setting', () => {
    const errors = analyze(`${PRELUDE}Dep: a -> b [highlight: #ff0000]`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: multiple settings', () => {
    const errors = analyze(`${PRELUDE}Dep: a -> b [color: #fff, note: 'x', owner: 'team']`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('invalid: color with non-color value', () => {
    const errors = analyze(`${PRELUDE}Dep: a -> b [color: notacolor]`).getErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('color'))).toBe(true);
  });

  it('invalid: note with non-string value', () => {
    const errors = analyze(`${PRELUDE}Dep: a -> b [note: 123]`).getErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('note'))).toBe(true);
  });
});

describe('dep body sub-element validation', () => {
  it('valid: color body sub-declaration', () => {
    const errors = analyze(`${PRELUDE}
Dep {
  a -> b
  color: #aabbcc
}`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: note body sub-declaration', () => {
    const errors = analyze(`${PRELUDE}
Dep {
  a -> b
  note: 'hello'
}`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: custom string body sub-declaration', () => {
    const errors = analyze(`${PRELUDE}
Dep {
  a -> b
  owner: 'data-team'
}`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: custom identifier body sub-declaration', () => {
    const errors = analyze(`${PRELUDE}
Dep {
  a -> b
  materialized: view
}`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('valid: custom numeric body sub-declaration', () => {
    const errors = analyze(`${PRELUDE}
Dep {
  a -> b
  priority: 1
}`).getErrors();
    expect(errors).toHaveLength(0);
  });

  it('invalid: color body sub-declaration with non-color', () => {
    const errors = analyze(`${PRELUDE}
Dep {
  a -> b
  color: notacolor
}`).getErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('color'))).toBe(true);
  });

  it('invalid: note body sub-declaration with non-string', () => {
    const errors = analyze(`${PRELUDE}
Dep {
  a -> b
  note: 123
}`).getErrors();
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('note'))).toBe(true);
  });
});
