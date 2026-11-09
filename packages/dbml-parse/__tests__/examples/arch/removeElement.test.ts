import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';

const ARCH = `---
diagram_type: arch
---
`;
const MAIN = Filepath.from('/main.dbml');

function remove (source: string, handle: string): string | undefined {
  const layout = new MemoryProjectLayout();
  layout.setSource(MAIN, ARCH + source);
  return new Compiler(layout).removeElement(MAIN, handle).get(MAIN.absolute);
}

function collectDiagnostics (source: string): string[] {
  const layout = new MemoryProjectLayout();
  layout.setSource(MAIN, source);
  const compiler = new Compiler(layout);
  return [
    ...compiler.validateFile(MAIN).getErrors(),
    ...compiler.bindFile(MAIN).getErrors(),
  ].map((e) => e.diagnostic);
}

describe('[example] removing an element', () => {
  test('takes its declaration and the links to and from it', () => {
    const result = remove(`Server api
Database db
Cache c
Link: api > db
Link: c - api
Link: db > c
`, 'api');
    expect(result).toBe(`${ARCH}Database db
Cache c
Link: db > c
`);
    expect(collectDiagnostics(result!)).toEqual([]);
  });

  test('takes inline links on other elements that point at it, and keeps their other settings', () => {
    const result = remove(`Server api [color: #ff0000, link: > db]
Server web [link: > db]
Database db
`, 'db');
    expect(result).toBe(`${ARCH}Server api [color: #ff0000]
Server web
`);
    expect(collectDiagnostics(result!)).toEqual([]);
  });

  test('takes it out of the groups that list it, keeping the other members', () => {
    expect(remove(`Server a
Server b
Server c
Group g { a b c }
`, 'b'))
      .toBe(`${ARCH}Server a
Server c
Group g { a c }
`);
    expect(remove(`Server a
Server b
Group g {
  a
  b
}
`, 'b'))
      .toBe(`${ARCH}Server a
Group g {
  a
}
`);
    expect(remove(`Server a
Group g { a }
`, 'a'))
      .toBe(`${ARCH}Group g { }
`);
  });

  test('takes Metadata on it, in either target form', () => {
    expect(remove(`Server api
Metadata api {
  owner: 'x'
}
Metadata Server api {
  tier: 1
}
`, 'api'))
      .toBe(ARCH);
  });

  test('removes a group without removing its members', () => {
    expect(remove(`Server a
Group g { a }
Link: a > g
`, 'g')).toBe(`${ARCH}Server a
`);
  });

  test('finds an element by its alias', () => {
    expect(remove(`Server "API 1" as api1
Server b
Link: b > api1
`, 'api1')).toBe(`${ARCH}Server b
`);
  });

  test('changes nothing for a name that is not declared', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(MAIN, `${ARCH}Server a
`);
    expect(new Compiler(layout).removeElement(MAIN, 'ghost').size).toBe(0);
  });
});
