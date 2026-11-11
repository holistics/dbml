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

  it('reports a bare identifier value in the settings list', () => {
    const source = 'Dep pipeline: raw_orders -> stg_orders [owner: team_a]';
    expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_DEP_SETTING_VALUE);
  });

  it('reports a bare identifier value in a block-body field', () => {
    const source = `Dep pipeline {
  raw_orders -> stg_orders
  owner: team_a
}`;
    expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_DEP_SETTING_VALUE);
  });

  it('reports a valueless custom setting', () => {
    const source = 'Dep pipeline: raw_orders -> stg_orders [owner]';
    expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_DEP_SETTING_VALUE);
  });

  it('reports a duplicate custom setting', () => {
    const source = "Dep pipeline: raw_orders -> stg_orders [owner: 'a', owner: 'b']";
    expect(errorCodes(source)).toContain(CompileErrorCode.DUPLICATE_DEP_SETTING);
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
