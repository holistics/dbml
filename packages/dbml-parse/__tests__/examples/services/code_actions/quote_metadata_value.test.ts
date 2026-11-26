import { describe, expect, test } from 'vitest';
import { uniqBy } from 'lodash-es';
import Compiler from '@/compiler';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { DEFAULT_ENTRY } from '@/constants';
import type { QuickFix } from '@/core/types/errors';
import { createMockTextModel } from '@tests/utils';

const ARCH = '---\ndiagram_type: arch\n---\n';

function compile (source: string): Compiler {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, source);
  return new Compiler(layout);
}

function errorsOf (source: string) {
  return compile(source).interpretProject().getErrors();
}

function quoteFixes (source: string): QuickFix[] {
  const fixes = errorsOf(source).flatMap((e) => e.details?.quickFixes ?? []);
  return uniqBy(fixes, (f) => `${f.title}@${f.edits[0]?.start}`);
}

function applyFix (source: string, fix: QuickFix): string {
  return [...fix.edits]
    .sort((a, b) => b.start - a.start)
    .reduce((text, e) => text.slice(0, e.start) + e.newText + text.slice(e.end), source);
}

function messages (source: string): string[] {
  return [...new Set(errorsOf(source).map((e) => e.diagnostic))];
}

describe('[example] quick fix: quote a bare custom metadata value', () => {
  describe('quotes an identifier stream wherever a custom value is checked', () => {
    test.each([
      [
        'table setting list',
        'Table t [owner: data team] { id int }',
        'Table t [owner: \'data team\'] { id int }',
      ],
      [
        'column setting list',
        'Table t { id int [owner: data team] }',
        'Table t { id int [owner: \'data team\'] }',
      ],
      [
        'ref setting list',
        'Table a { id int }\nTable b { id int }\nRef r: a.id > b.id [owner: data team]',
        'Table a { id int }\nTable b { id int }\nRef r: a.id > b.id [owner: \'data team\']',
      ],
      [
        'Metadata block field',
        'Table t { id int }\nMetadata Table t {\n  owner: data team\n}',
        'Table t { id int }\nMetadata Table t {\n  owner: \'data team\'\n}',
      ],
      [
        'Dep body field',
        'Table a { id int }\nTable b { id int }\nDep d {\n  a.id -> b.id\n  owner: data team\n}',
        'Table a { id int }\nTable b { id int }\nDep d {\n  a.id -> b.id\n  owner: \'data team\'\n}',
      ],
      [
        'arch setting list',
        `${ARCH}Server api [owner: data team]`,
        `${ARCH}Server api [owner: 'data team']`,
      ],
      [
        'arch Metadata block field',
        `${ARCH}Server api\nMetadata api {\n  owner: data team\n}`,
        `${ARCH}Server api\nMetadata api {\n  owner: 'data team'\n}`,
      ],
    ])('%s', (_, source, expected) => {
      const fixes = quoteFixes(source);
      expect(fixes.map((f) => f.title)).toEqual(['Quote the value: \'data team\'']);
      expect(fixes[0].isPreferred).toBe(true);

      const fixed = applyFix(source, fixes[0]);
      expect(fixed).toBe(expected);
      expect(errorsOf(fixed)).toEqual([]);
    });
  });

  test('quotes a single identifier', () => {
    const source = 'Table t [owner: data] { id int }';
    const [fix] = quoteFixes(source);
    expect(applyFix(source, fix)).toBe('Table t [owner: \'data\'] { id int }');
  });

  test('the hint names the whole stream, not just its first word', () => {
    expect(messages('Table t { id int }\nMetadata Table t {\n  owner: data team\n}')).toEqual([
      'A Metadata field value must be a string, a color literal, a number literal, or a boolean literal. Did you mean \'data team\'? Text values must be quoted',
    ]);
    expect(messages('Table t [owner: data team] { id int }')).toEqual([
      'Custom setting \'owner\' must be a string, a color literal, a number literal, or a boolean literal. Did you mean \'data team\'? Text values must be quoted',
    ]);
  });

  test.each([
    ['a member access', 'Table t [owner: a.b] { id int }'],
    ['a field with a setting list', 'Table t { id int }\nMetadata Table t {\n  owner: data [x]\n}'],
    ['a bare flag', 'Table t [owner] { id int }'],
  ])('offers no fix for %s', (_, source) => {
    expect(errorsOf(source).length).toBeGreaterThan(0);
    expect(quoteFixes(source)).toEqual([]);
  });

  test('the code action provider offers the fix on the error marker', () => {
    const source = 'Table t [owner: data team] { id int }';
    const compiler = compile(source);
    const services = compiler.initMonacoServices();
    const markers = services.diagnosticsProvider.provideMarkers(DEFAULT_ENTRY);
    expect(markers).toHaveLength(1);

    const model = createMockTextModel(source);
    const result = services.codeActionProvider.provideCodeActions(model, undefined as any, { markers } as any, undefined as any);
    expect(result?.actions.map((a) => a.title)).toEqual(['Quote the value: \'data team\'']);
    expect(result?.actions[0].kind).toBe('quickfix');
    expect((result?.actions[0].edit as any)?.edits[0].textEdit).toEqual({
      range: {
        startLineNumber: 1, startColumn: 17, endLineNumber: 1, endColumn: 26,
      },
      text: '\'data team\'',
    });
  });
});
