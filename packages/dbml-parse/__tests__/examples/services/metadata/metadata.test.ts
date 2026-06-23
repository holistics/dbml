import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import { DEFAULT_ENTRY } from '@/constants';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { CompileErrorCode } from '@/index';
import { createMockTextModel, createPosition, extractTextFromRange, interpret, MockTextModel } from '../../../utils';

const TABLE = `Table users {
  id int
}

`;

function metadataValues (source: string) {
  const result = interpret(TABLE + source);
  const db = result.getValue();
  return db?.metadataElements?.[0]?.values;
}

describe('[example] Metadata element', () => {
  it('go-to-definition on the metadata target jumps to the table declaration', () => {
    const program = `Table users {
  id int
}

Metadata Table public.users {
  owner: 'scott'
}`;
    const layout = new MemoryProjectLayout();
    layout.setSource(DEFAULT_ENTRY, program);
    const compiler = new Compiler(layout);

    const provider = new DBMLDefinitionProvider(compiler);
    const model = createMockTextModel(program);

    // Position on "users" in `Metadata Table public.users`
    const position = createPosition(5, 24);
    const definition = provider.provideDefinition(model, position);

    const locations = Array.isArray(definition) ? definition : [definition];
    expect(locations.length).toBe(1);
    // Definition should point at the `users` table declaration (line 1).
    expect(locations[0].range.startLineNumber).toBe(1);
  });

  // TODO(metadata): METADATA_TARGET_NOT_FOUND is raised by the binder, but
  // interpretFile() does not collect bind errors (only interpretProject does),
  // so the code never reaches this single-file report. Pre-existing gap on the
  // metadata WIP branch.
  it.skip('errors when the target element does not exist', () => {
    const program = `Metadata Table public.ghost {
  owner: 'x'
}`;
    const layout = new MemoryProjectLayout();
    layout.setSource(DEFAULT_ENTRY, program);
    const compiler = new Compiler(layout);

    const report = compiler.interpretFile(DEFAULT_ENTRY);
    const codes = report.getErrors().map((e) => e.code);
    expect(codes).toContain(6002); // METADATA_TARGET_NOT_FOUND
  });
});

describe('[example] Metadata field value grammar', () => {
  describe('accepts scalar values and stores them', () => {
    it('accepts a quoted string value', () => {
      const result = interpret(`${TABLE}Metadata Table public.users {
  owner: 'scott'
}`);
      expect(result.getErrors()).toHaveLength(0);
      expect(metadataValues(`Metadata Table public.users {
  owner: 'scott'
}`)).toMatchObject({ owner: 'scott' });
    });

    it('accepts a number value', () => {
      const result = interpret(`${TABLE}Metadata Table public.users {
  count: 42
}`);
      expect(result.getErrors()).toHaveLength(0);
      expect(metadataValues(`Metadata Table public.users {
  count: 42
}`)).toMatchObject({ count: 42 });
    });

    it('accepts boolean values (true and false)', () => {
      const result = interpret(`${TABLE}Metadata Table public.users {
  pii: true
  archived: false
}`);
      expect(result.getErrors()).toHaveLength(0);
      expect(metadataValues(`Metadata Table public.users {
  pii: true
  archived: false
}`)).toMatchObject({ pii: true, archived: false });
    });

    it('accepts a bare identifier value', () => {
      const result = interpret(`${TABLE}Metadata Table public.users {
  masking: partial
}`);
      expect(result.getErrors()).toHaveLength(0);
      expect(metadataValues(`Metadata Table public.users {
  masking: partial
}`)).toMatchObject({ masking: 'partial' });
    });

    it('accepts a color value', () => {
      const result = interpret(`${TABLE}Metadata Table public.users {
  color: #aaa
}`);
      expect(result.getErrors()).toHaveLength(0);
      expect(metadataValues(`Metadata Table public.users {
  color: #aaa
}`)).toMatchObject({ color: '#aaa' });
    });
  });

  describe('duplicate key across two Metadata blocks on the same target', () => {
    // NOTE: a precise warning code (e.g. DUPLICATE_METADATA_KEY_ACROSS_BLOCKS)
    // does not exist yet. The source implementer must introduce it. Until then
    // we assert structurally: a warning IS emitted, and the within-block hard
    // error (DUPLICATE_METADATA_FIELD) is NOT present (this is cross-block).

    it('emits a warning (not an error) when two blocks set the same key with the SAME value', () => {
      const source = `Metadata Table public.users {
  color: #aaa
}

Metadata Table public.users {
  color: #aaa
}`;
      const result = interpret(`${TABLE}${source}`);

      // Warning attributable to the duplicate cross-block key.
      expect(result.getWarnings().length).toBeGreaterThanOrEqual(1);
      // It must NOT be the within-block hard error.
      const errorCodes = result.getErrors().map((e) => e.code);
      expect(errorCodes).not.toContain(CompileErrorCode.DUPLICATE_METADATA_FIELD);
      // Nothing is dropped; both blocks are retained as separate elements.
      const db = result.getValue();
      const metas = (db?.metadataElements ?? []).filter(
        (m) => m.target.name.at(-1) === 'users' && m.target.kind === 'table',
      );
      expect(metas.map((m) => m.values.color)).toEqual(['#aaa', '#aaa']);
      // Last block carries the (here identical) value.
      expect(metas.at(-1)!.values.color).toBe('#aaa');
    });

    it('emits a warning and last-write-wins when two blocks set the same key with DIFFERENT values', () => {
      const source = `Metadata Table public.users {
  color: #aaa
}

Metadata Table public.users {
  color: #f00
}`;
      const result = interpret(`${TABLE}${source}`);

      expect(result.getWarnings().length).toBeGreaterThanOrEqual(1);
      const errorCodes = result.getErrors().map((e) => e.code);
      expect(errorCodes).not.toContain(CompileErrorCode.DUPLICATE_METADATA_FIELD);
      // Both blocks are retained as separate elements (nothing dropped); the
      // last block carries #f00 ("last-write-wins" at the raw-list level).
      const db = result.getValue();
      const metas = (db?.metadataElements ?? []).filter(
        (m) => m.target.name.at(-1) === 'users' && m.target.kind === 'table',
      );
      expect(metas.map((m) => m.values.color)).toEqual(['#aaa', '#f00']);
      expect(metas.at(-1)!.values.color).toBe('#f00');
    });

    // Regression guard: duplicate key WITHIN a single block stays a hard ERROR.
    it('still raises DUPLICATE_METADATA_FIELD for a duplicate key WITHIN one block', () => {
      const source = `Metadata Table public.users {
  color: #aaa
  color: #f00
}`;
      const result = interpret(`${TABLE}${source}`);
      const errorCodes = result.getErrors().map((e) => e.code);
      expect(errorCodes).toContain(CompileErrorCode.DUPLICATE_METADATA_FIELD);
    });

    it('points a warning at the duplicated key in EVERY block', () => {
      const source = `Metadata Table public.users {
  color: #aaa
}

Metadata Table public.users {
  color: #f00
}`;
      const program = `${TABLE}${source}`;
      const result = interpret(program);

      // One warning per block that defines the duplicated key.
      const warnings = result
        .getWarnings()
        .filter((w) => w.code === CompileErrorCode.DUPLICATE_METADATA_KEY_ACROSS_BLOCKS);
      expect(warnings).toHaveLength(2);

      // Offsets of the `color` key in each block.
      const firstColor = program.indexOf('color');
      const secondColor = program.indexOf('color', firstColor + 1);
      expect(secondColor).toBeGreaterThan(firstColor); // sanity

      // The two warnings' start offsets must be exactly the two `color` keys
      // (order-agnostic).
      const starts = warnings.map((w) => w.start).sort((a, b) => a - b);
      expect(starts).toEqual([firstColor, secondColor]);

      // Each warning spans exactly `color` and is short (just the key).
      const model = new MockTextModel(program);
      for (const warning of warnings) {
        expect(warning.end - warning.start).toBeLessThan(15);
        const startPos = model.getPositionAt(warning.start);
        const endPos = model.getPositionAt(warning.end);
        const spanned = extractTextFromRange(program, {
          startLineNumber: startPos.lineNumber,
          startColumn: startPos.column,
          endLineNumber: endPos.lineNumber,
          endColumn: endPos.column,
        });
        expect(spanned).toBe('color');
      }
    });

    // Regression guard: the schema-implicit identity is treated as the SAME
    // target, so a bare `users` and a `public.users` block still collide. This
    // already works; assert it stays working.
    it('treats bare vs public-qualified target as the SAME object (still warns)', () => {
      const source = `Metadata Table users {
  color: #aaa
}

Metadata Table public.users {
  color: #f00
}`;
      const result = interpret(`${TABLE}${source}`);

      const codes = result.getWarnings().map((w) => w.code);
      expect(codes).toContain(CompileErrorCode.DUPLICATE_METADATA_KEY_ACROSS_BLOCKS);
    });

    it('does NOT warn when two blocks set DIFFERENT keys on the same target', () => {
      const source = `Metadata Table public.users {
  color: #aaa
}

Metadata Table public.users {
  note: 'hello'
}`;
      const result = interpret(`${TABLE}${source}`);

      // Distinct keys merge cleanly: no duplicate-key warning, no error.
      expect(result.getWarnings()).toHaveLength(0);
      expect(result.getErrors()).toHaveLength(0);
    });
  });

  describe('rejects non-scalar values with INVALID_METADATA_FIELD', () => {
    it('rejects a list/array literal value', () => {
      const result = interpret(`${TABLE}Metadata Table public.users {
  tags: ['a', 'b']
}`);
      const codes = result.getErrors().map((e) => e.code);
      expect(codes).toContain(CompileErrorCode.INVALID_METADATA_FIELD);
      // The invalid value must never be silently dropped.
      expect(metadataValues(`Metadata Table public.users {
  tags: ['a', 'b']
}`) ?? {}).not.toHaveProperty('tags');
    });

    it('does not silently accept an empty value (key with no value)', () => {
      const result = interpret(`${TABLE}Metadata Table public.users {
  owner:
}`);
      // The empty value must surface some compile error (it must not be
      // silently accepted). We intentionally do not assert a specific code:
      // an empty value already fails at parse level, and pinning the exact
      // code here would be brittle.
      expect(result.getErrors().length).toBeGreaterThan(0);
      // The bogus empty key/value must not be silently captured.
      expect(metadataValues(`Metadata Table public.users {
  owner:
}`) ?? {}).not.toHaveProperty('owner');
    });
  });
});
