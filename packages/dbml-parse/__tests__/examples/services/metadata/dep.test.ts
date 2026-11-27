import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import { DEFAULT_ENTRY } from '@/constants';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/index';
import {
  createMockTextModel, createPosition, excludeMetadataValueToken, interpret,
} from '../../../utils';

const TABLES = `Table raw_orders {
  id int [pk]
}

Table stg_orders {
  id int [pk]
}

`;

function deps (source: string) {
  return interpret(TABLES + source).getValue()?.deps ?? [];
}

function dep (source: string, name: string) {
  return deps(source).find((d) => d.name === name);
}

function errorCodes (source: string) {
  return interpret(TABLES + source).getErrors().map((e) => e.code);
}

function warningCodes (source: string) {
  return interpret(TABLES + source).getWarnings().map((w) => w.code);
}

function setup (program: string) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, program);
  return {
    compiler: new Compiler(layout),
    model: createMockTextModel(program),
  };
}

describe('[example] Metadata Dep', () => {
  describe('promotion', () => {
    it('promotes color and note, keeps the rest in dep.metadata', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
}

Metadata Dep pipeline {
  color: #e67e22
  note: 'Nightly'
  sla: '2h'
}`;
      expect(errorCodes(source)).toEqual([]);
      const d = dep(source, 'pipeline')!;
      expect(d.color).toBe('#e67e22');
      expect(d.note?.value).toBe('Nightly');
      expect(excludeMetadataValueToken(d.metadata)).toEqual({ sla: { value: '2h', type: 'string' } });
    });

    it('rejects a non-color color value', () => {
      const source = `Dep pipeline { raw_orders -> stg_orders }

Metadata Dep pipeline {
  color: 'red'
}`;
      expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
    });

    it('rejects a non-string note value', () => {
      const source = `Dep pipeline { raw_orders -> stg_orders }

Metadata Dep pipeline {
  note: #fff
}`;
      expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
    });
  });

  describe('target resolution', () => {
    it('reports an unknown dep name', () => {
      const source = `Dep pipeline { raw_orders -> stg_orders }

Metadata Dep nope {
  color: #e67e22
}`;
      const errors = interpret(TABLES + source).getErrors();
      expect(errors.map((e) => e.code)).toContain(CompileErrorCode.BINDING_ERROR);
      expect(errors.map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Dep nope`');
    });

    it('resolves a `public`-qualified dep target', () => {
      const source = `Dep pipeline { raw_orders -> stg_orders }

Metadata Dep public.pipeline {
  color: #e67e22
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(dep(source, 'pipeline')?.color).toBe('#e67e22');
    });

    it('does not resolve a dep target qualified with another schema', () => {
      const source = `Dep pipeline { raw_orders -> stg_orders }

Metadata Dep etl.pipeline {
  color: #e67e22
}`;
      const errors = interpret(TABLES + source).getErrors();
      expect(errors.map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Dep etl.pipeline`');
      expect(dep(source, 'pipeline')?.color).toBeUndefined();
    });

    it('reports a dep target with too many name parts as not found', () => {
      const source = `Dep pipeline { raw_orders -> stg_orders }

Metadata Dep a.public.pipeline {
  color: #e67e22
}`;
      const errors = interpret(TABLES + source).getErrors();
      expect(errors.map((e) => e.code)).not.toContain(CompileErrorCode.INVALID_NAME);
      expect(errors.map((e) => e.diagnostic)).toContain('Cannot find metadata target element: `Dep a.public.pipeline`');
    });

    it('accepts a quoted dep name', () => {
      const source = `Dep "my pipeline" { raw_orders -> stg_orders }

Metadata Dep "my pipeline" {
  color: #e67e22
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(dep(source, 'my pipeline')?.color).toBe('#e67e22');
    });
  });

  describe('duplicate dep names', () => {
    it('allows two deps with the same name until a Metadata block targets the name', () => {
      const source = `Dep d { raw_orders -> stg_orders }
Dep d { stg_orders -> raw_orders }`;
      expect(errorCodes(source)).toEqual([]);
    });

    it('reports a Metadata block targeting a dep name declared twice as ambiguous', () => {
      const source = `Dep d { raw_orders -> stg_orders }
Dep d { stg_orders -> raw_orders }

Metadata Dep d {
  color: #e67e22
}`;
      const errors = interpret(TABLES + source).getErrors();
      expect(errors.map((e) => e.diagnostic)).toContain("Dep 'd' is ambiguous: it has multiple definitions");
    });

    it('allows any number of unnamed deps', () => {
      const source = `Dep { raw_orders -> stg_orders }
Dep { stg_orders -> raw_orders }`;
      expect(errorCodes(source)).toEqual([]);
    });
  });
});

describe('[example] Dep inline custom metadata', () => {
  it('reads typed values from the settings list and the block-body fields', () => {
    const source = `Dep pipeline [owner: 'data', sla: 3] {
  raw_orders -> stg_orders [critical: true]
  tint: #abc
}`;
    expect(errorCodes(source)).toEqual([]);
    expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
      owner: { value: 'data', type: 'string' },
      sla: { value: 3, type: 'number' },
      critical: { value: true, type: 'bool' },
      tint: { value: '#abc', type: 'color' },
    });
  });

  describe('unquoted legacy values', () => {
    const QUOTE_HINT = 'must be a string, a color literal, a number literal, or a boolean literal';

    function messages (source: string) {
      return interpret(TABLES + source).getErrors().map((e) => e.diagnostic);
    }

    function warnings (source: string) {
      return interpret(TABLES + source).getWarnings().map((w) => ({ code: w.code, message: w.diagnostic }));
    }

    function legacyWarning (key: string, text: string, quoted?: string) {
      return {
        code: CompileErrorCode.DEPRECATED_DEP_SETTING_VALUE,
        message: `Custom setting '${key}' has an unquoted text value, which is deprecated. Did you mean ${quoted ?? `'${text}'`}? Text values should be quoted`,
      };
    }

    it('accepts a bare identifier block-body value as a string, with a warning', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  materialized: table
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('materialized', 'table')]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
        materialized: { value: 'table', type: 'string' },
      });
    });

    it('accepts a bare multi-word block-body value as one string, with a warning', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: data team
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('owner', 'data team')]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
        owner: { value: 'data team', type: 'string' },
      });
    });

    it('accepts `null` as the string \'null\', with a warning', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: null
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('owner', 'null')]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
        owner: { value: 'null', type: 'string' },
      });
    });

    it('accepts a bare value in the header settings list, with a warning', () => {
      const source = 'Dep pipeline: raw_orders -> stg_orders [materialized: table]';
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('materialized', 'table')]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
        materialized: { value: 'table', type: 'string' },
      });
    });

    it('accepts a bare multi-word value in an edge settings list, with a warning', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders [owner: data team]
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('owner', 'data team')]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
        owner: { value: 'data team', type: 'string' },
      });
    });

    it.each([
      ['a boolean', 'true b', 'true b'],
      ['an identifier', 'data team b', 'data team b'],
    ])('reads a body value starting with %s as the whole line, with a warning', (_, text, expected) => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: ${text}
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('owner', expected)]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
        owner: { value: expected, type: 'string' },
      });
    });

    // The value is the line as written. The hint quotes it with double quotes if it has a single quote, else single quotes with escapes
    it.each([
      ['a quoted string', "'x' b", "'x' b", '"\'x\' b"'],
      ['a number', '1 b', '1 b', "'1 b'"],
      ['a color', '#fff b', '#fff b', "'#fff b'"],
      ['a double-quoted string', '"x" b', '"x" b', '\'"x" b\''],
      ['both kinds of quote', '\'a\' "b"', '\'a\' "b"', '\'\\\'a\\\' "b"\''],
      ['an escaped quote', String.raw`'it\'s' b`, String.raw`'it\'s' b`, String.raw`"'it\\'s' b"`],
    ])('reads a body value starting with %s as the whole line, with a warning', (_, text, expected, quoted) => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: ${text}
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('owner', expected, quoted)]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
        owner: { value: expected, type: 'string' },
      });
    });

    it('keeps the quotes of a double-quoted word after an identifier', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: data "team"
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('owner', 'data "team"')]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({
        owner: { value: 'data "team"', type: 'string' },
      });
    });

    it('still reports the warning when another error stops interpretation', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: data team
}
Ref: raw_orders.id > missing.id`;
      expect(errorCodes(source).length).toBeGreaterThan(0);
      expect(warnings(source)).toEqual([legacyWarning('owner', 'data team')]);
    });

    it('lets a quoted Metadata Dep value override a deprecated bare value', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: data team
}

Metadata Dep pipeline {
  owner: 'block'
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([legacyWarning('owner', 'data team')]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({ owner: { value: 'block', type: 'string' } });
    });

    it('still rejects a body value followed by a settings list', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: 'x' [b]
}`;
      expect(errorCodes(source)).toEqual([CompileErrorCode.INVALID_DEP_SETTING_VALUE]);
      expect(warnings(source)).toEqual([]);
    });

    it('still rejects an identifier followed by a double-quoted word in a Metadata Dep block, without a hint', () => {
      const source = `Dep pipeline: raw_orders -> stg_orders
Metadata Dep pipeline {
  owner: data "team"
}`;
      expect(messages(source)).toEqual([`A Metadata field value ${QUOTE_HINT}`]);
    });

    it('still rejects a quoted string followed by more words in a Metadata Dep block, without a hint', () => {
      const source = `Dep pipeline: raw_orders -> stg_orders
Metadata Dep pipeline {
  owner: 'x' b
}`;
      expect(messages(source)).toEqual([`A Metadata field value ${QUOTE_HINT}`]);
    });

    it('still rejects a multi-word value starting with a boolean in a Metadata Dep block', () => {
      const source = `Dep pipeline: raw_orders -> stg_orders
Metadata Dep pipeline {
  owner: true b
}`;
      expect(messages(source)).toEqual([`A Metadata field value ${QUOTE_HINT}. Did you mean 'true b'? Text values must be quoted`]);
    });

    it('still rejects a bare identifier in a Metadata Dep block', () => {
      const source = `Dep pipeline: raw_orders -> stg_orders
Metadata Dep pipeline {
  materialized: table
}`;
      expect(messages(source)).toEqual([`A Metadata field value ${QUOTE_HINT}. Did you mean 'table'? Text values must be quoted`]);
    });

    it('still rejects a bare identifier in a Table inline setting', () => {
      const source = 'Table t [owner: data_team] { id int }';
      expect(messages(source)).toEqual([`Custom setting 'owner' ${QUOTE_HINT}. Did you mean 'data_team'? Text values must be quoted`]);
    });

    it('still rejects a bare value for a builtin Dep field', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  color: blue
}`;
      expect(errorCodes(source)).toEqual([CompileErrorCode.INVALID_DEP_SETTING_VALUE]);
      expect(warnings(source)).toEqual([]);
    });

    it('still rejects a non-identifier value, without a hint', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: a.b
}`;
      expect(messages(source)).toEqual([`Custom setting 'owner' ${QUOTE_HINT}`]);
      expect(warnings(source)).toEqual([]);
    });

    it('accepts the quoted form without a warning', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  materialized: 'table'
  owner: 'data-team'
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warnings(source)).toEqual([]);
    });
  });

  it('reports a valueless custom setting', () => {
    const source = 'Dep pipeline: raw_orders -> stg_orders [owner]';
    expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_DEP_SETTING_VALUE);
  });

  it('reports a duplicate custom setting', () => {
    const source = "Dep pipeline: raw_orders -> stg_orders [owner: 'a', owner: 'b']";
    expect(errorCodes(source)).toContain(CompileErrorCode.DUPLICATE_DEP_SETTING);
  });

  describe('block-form edge settings list', () => {
    it('warns on a bare identifier value and drops nothing silently', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders [owner: data]
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(warningCodes(source)).toEqual([CompileErrorCode.DEPRECATED_DEP_SETTING_VALUE]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({ owner: { value: 'data', type: 'string' } });
    });

    it('reports an invalid value and drops nothing silently', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders [owner: a.b]
}`;
      expect(errorCodes(source)).toEqual([CompileErrorCode.INVALID_DEP_SETTING_VALUE]);
    });

    it('reports invalid builtin values', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders [color: red, note: 12]
}`;
      expect(errorCodes(source)).toEqual([
        CompileErrorCode.INVALID_DEP_SETTING_VALUE,
        CompileErrorCode.INVALID_DEP_SETTING_VALUE,
      ]);
    });

    it('reports a duplicate key within one list once per occurrence', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders [owner: 'x', owner: 'y']
}`;
      expect(errorCodes(source)).toEqual([
        CompileErrorCode.DUPLICATE_DEP_SETTING,
        CompileErrorCode.DUPLICATE_DEP_SETTING,
      ]);
    });

    it('reports a short-form settings error only once', () => {
      const source = 'Dep pipeline: raw_orders -> stg_orders [owner: a.b]';
      expect(errorCodes(source)).toEqual([CompileErrorCode.INVALID_DEP_SETTING_VALUE]);
    });

    it('reports a short-form settings warning only once', () => {
      const source = 'Dep pipeline: raw_orders -> stg_orders [owner: data]';
      expect(warningCodes(source)).toEqual([CompileErrorCode.DEPRECATED_DEP_SETTING_VALUE]);
    });
  });

  describe('multi-word custom keys', () => {
    it.each([
      ['header list', "Dep pipeline [data owner: 'x'] {\n  raw_orders -> stg_orders\n}"],
      ['short-form list', "Dep pipeline: raw_orders -> stg_orders [data owner: 'x']"],
      ['block-form edge list', "Dep pipeline {\n  raw_orders -> stg_orders [data owner: 'x']\n}"],
    ])('accepts a multi-word key in the %s, like other inline settings', (_, source) => {
      expect(errorCodes(source)).toEqual([]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({ 'data owner': { value: 'x', type: 'string' } });
    });
  });

  describe('duplicate keys across sources', () => {
    const DUP = [
      CompileErrorCode.DUPLICATE_DEP_SETTING,
      CompileErrorCode.DUPLICATE_DEP_SETTING,
    ];

    it('reports body fields differing only in case', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  Owner: 'x'
  owner: 'y'
}`;
      expect(errorCodes(source)).toEqual(DUP);
    });

    it('reports repeated body fields', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: 'x'
  owner: 'y'
}`;
      expect(errorCodes(source)).toEqual(DUP);
    });

    it('reports a header key repeated in a body field', () => {
      const source = `Dep pipeline [owner: 'x'] {
  raw_orders -> stg_orders
  owner: 'y'
}`;
      expect(errorCodes(source)).toEqual(DUP);
    });

    it('reports a key repeated across edge lists', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders [owner: 'x']
  stg_orders -> raw_orders [owner: 'y']
}`;
      expect(errorCodes(source)).toContain(CompileErrorCode.DUPLICATE_DEP_SETTING);
      expect(errorCodes(source).filter((c) => c === CompileErrorCode.DUPLICATE_DEP_SETTING)).toHaveLength(2);
    });

    it('reports a builtin repeated across header and body', () => {
      const source = `Dep pipeline [color: #fff] {
  raw_orders -> stg_orders
  color: #000
}`;
      expect(errorCodes(source)).toEqual(DUP);
    });

    it('lowercases a body-field key', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  Owner: 'x'
}`;
      expect(errorCodes(source)).toEqual([]);
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({ owner: { value: 'x', type: 'string' } });
    });

    it('merges a mixed-case body key with a Metadata block key', () => {
      const source = `Dep pipeline {
  raw_orders -> stg_orders
  Owner: 'inline'
}

Metadata Dep pipeline {
  owner: 'block'
}`;
      expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({ owner: { value: 'block', type: 'string' } });
    });
  });

  it('lets a Metadata block override an inline custom setting', () => {
    const source = `Dep pipeline: raw_orders -> stg_orders [owner: 'inline']

Metadata Dep pipeline {
  owner: 'block'
}`;
    expect(excludeMetadataValueToken(dep(source, 'pipeline')?.metadata)).toEqual({ owner: { value: 'block', type: 'string' } });
  });
});

describe('[example] Metadata Dep services', () => {
  const program = `${TABLES}Dep pipeline { raw_orders -> stg_orders }

Metadata Dep pipeline {
  color: #e67e22
}`;
  // `Dep pipeline` is on line 9, `Metadata Dep pipeline` on line 11
  const metadataLine = 11;

  it('go-to-definition on the target name jumps to the dep declaration', () => {
    const { compiler, model } = setup(program);
    const provider = new DBMLDefinitionProvider(compiler);
    const definition = provider.provideDefinition(model, createPosition(metadataLine, 16));
    const locations = Array.isArray(definition) ? definition : [definition];
    expect(locations).toHaveLength(1);
    expect(locations[0].range.startLineNumber).toBe(9);
  });

  it('find-references on the dep name includes the Metadata target', () => {
    const { compiler, model } = setup(program);
    const provider = new DBMLReferencesProvider(compiler);
    const references = provider.provideReferences(model, createPosition(9, 6));
    expect(references.map((r) => r.range.startLineNumber)).toContain(metadataLine);
  });

  describe('ambiguous target name', () => {
    const ambiguousProgram = `${TABLES}Dep pipe { raw_orders -> stg_orders }
Dep pipe { stg_orders -> raw_orders }

Metadata Dep pipe {
  color: #e67e22
}`;
    // `Dep pipe` on lines 9 and 10, `Metadata Dep pipe` on line 12

    it('go-to-definition on the target name offers every declaration', () => {
      const { compiler, model } = setup(ambiguousProgram);
      const provider = new DBMLDefinitionProvider(compiler);
      const definition = provider.provideDefinition(model, createPosition(12, 16));
      const locations = Array.isArray(definition) ? definition : [definition];
      expect(locations.map((l) => l.range.startLineNumber).sort((a, b) => a - b)).toEqual([9, 10]);
    });

    it('find-references on the target name includes every declaration and the header once', () => {
      const { compiler, model } = setup(ambiguousProgram);
      const provider = new DBMLReferencesProvider(compiler);
      const references = provider.provideReferences(model, createPosition(12, 16));
      expect(references.map((r) => r.range.startLineNumber).sort((a, b) => a - b)).toEqual([9, 10, 12]);
    });
  });

  it('suggests Dep as a Metadata target kind', () => {
    const { compiler, model } = setup('Metadata ');
    const provider = new DBMLCompletionItemProvider(compiler);
    const labels = provider.provideCompletionItems(model, createPosition(1, 10)).suggestions.map((s) => s.label);
    expect(labels).toContain('Dep');
  });

  it('suggests visible named deps, but not tables or unnamed deps, after `Metadata Dep`', () => {
    const source = `${TABLES}Dep pipeline { raw_orders -> stg_orders }
Dep "other pipeline" { stg_orders -> raw_orders }
Dep { raw_orders -> stg_orders }

Metadata Dep `;
    const { compiler, model } = setup(source);
    const provider = new DBMLCompletionItemProvider(compiler);
    const suggestions = provider.provideCompletionItems(model, createPosition(13, 14)).suggestions;
    expect(suggestions.map((s) => s.label)).toEqual(['pipeline', 'other pipeline']);
    expect(suggestions.map((s) => s.insertText)).toEqual(['pipeline', '"other pipeline"']);
  });
});
