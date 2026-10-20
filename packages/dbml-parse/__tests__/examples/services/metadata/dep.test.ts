import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import DBMLDefinitionProvider from '@/services/definition/provider';
import DBMLReferencesProvider from '@/services/references/provider';
import { DEFAULT_ENTRY } from '@/constants';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/index';
import { createMockTextModel, createPosition, interpret } from '../../../utils';

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
      expect(d.metadata).toEqual({ sla: '2h' });
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

    it('rejects a schema-qualified dep target', () => {
      const source = `Dep pipeline { raw_orders -> stg_orders }

Metadata Dep public.pipeline {
  color: #e67e22
}`;
      expect(errorCodes(source)).toContain(CompileErrorCode.INVALID_NAME);
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
    it('reports two deps with the same name in one file', () => {
      const source = `Dep d { raw_orders -> stg_orders }
Dep d { stg_orders -> raw_orders }`;
      const errors = interpret(TABLES + source).getErrors();
      expect(errors.map((e) => e.code)).toContain(CompileErrorCode.DUPLICATE_NAME);
      expect(errors.map((e) => e.diagnostic)).toContain("Dep 'd' already exists in schema 'public'");
    });

    it('allows any number of unnamed deps', () => {
      const source = `Dep { raw_orders -> stg_orders }
Dep { stg_orders -> raw_orders }`;
      expect(errorCodes(source)).toEqual([]);
    });
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
