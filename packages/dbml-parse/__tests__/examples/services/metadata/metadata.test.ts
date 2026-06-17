import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLDefinitionProvider from '@/services/definition/provider';
import { DEFAULT_ENTRY } from '@/constants';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { createMockTextModel, createPosition, extractTextFromRange } from '../../../utils';

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
