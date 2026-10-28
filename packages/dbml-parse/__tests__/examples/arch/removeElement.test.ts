import { describe, expect, test } from 'vitest';
import Compiler from '@/compiler';
import { Filepath } from '@/core/types/filepath';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';

const ARCH = '---\ndiagram_type: arch\n---\n';
const MAIN = Filepath.from('/main.dbml');

function remove (source: string, handle: string): string | undefined {
  const layout = new MemoryProjectLayout();
  layout.setSource(MAIN, ARCH + source);
  return new Compiler(layout).removeElement(MAIN, handle).get(MAIN.absolute);
}

function errorsOf (source: string): string[] {
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
    const result = remove('Server api\nDatabase db\nCache c\nLink: api > db\nLink: c - api\nLink: db > c\n', 'api');
    expect(result).toBe(`${ARCH}Database db\nCache c\nLink: db > c\n`);
    expect(errorsOf(result!)).toEqual([]);
  });

  test('takes inline links on other elements that point at it, and keeps their other settings', () => {
    const result = remove("Server api [color: '#ff0000', link: > db]\nServer web [link: > db]\nDatabase db\n", 'db');
    expect(result).toBe(`${ARCH}Server api [color: '#ff0000']\nServer web\n`);
    expect(errorsOf(result!)).toEqual([]);
  });

  test('takes it out of the groups that list it, keeping the other members', () => {
    expect(remove('Server a\nServer b\nServer c\nGroup g { a b c }\n', 'b'))
      .toBe(`${ARCH}Server a\nServer c\nGroup g { a c }\n`);
    expect(remove('Server a\nServer b\nGroup g {\n  a\n  b\n}\n', 'b'))
      .toBe(`${ARCH}Server a\nGroup g {\n  a\n}\n`);
    expect(remove('Server a\nGroup g { a }\n', 'a'))
      .toBe(`${ARCH}Group g { }\n`);
  });

  test('takes Metadata on it, in either target form', () => {
    expect(remove("Server api\nMetadata api {\n  owner: 'x'\n}\nMetadata Server api {\n  tier: 1\n}\n", 'api'))
      .toBe(ARCH);
  });

  test('removes a group without removing its members', () => {
    expect(remove('Server a\nGroup g { a }\nLink: a > g\n', 'g')).toBe(`${ARCH}Server a\n`);
  });

  test('finds an element by its alias', () => {
    expect(remove('Server "API 1" as api1\nServer b\nLink: b > api1\n', 'api1')).toBe(`${ARCH}Server b\n`);
  });

  test('changes nothing for a name that is not declared', () => {
    const layout = new MemoryProjectLayout();
    layout.setSource(MAIN, `${ARCH}Server a\n`);
    expect(new Compiler(layout).removeElement(MAIN, 'ghost').size).toBe(0);
  });
});
