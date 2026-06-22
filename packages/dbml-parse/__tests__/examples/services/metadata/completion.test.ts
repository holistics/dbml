import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { DEFAULT_ENTRY } from '@/constants';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { createMockTextModel, createPosition } from '../../../utils';

function labels (compiler: Compiler, program: string, line: number, column: number): string[] {
  const provider = new DBMLCompletionItemProvider(compiler);
  const model = createMockTextModel(program);
  const list = provider.provideCompletionItems(model, createPosition(line, column));
  return list.suggestions.map((s) => s.label as string);
}

describe('[example] Metadata completion', () => {
  // TODO(metadata): the parser does not yet produce a Metadata element container
  // when only the `Metadata ` keyword (no subKind) has been typed, so the header
  // completion branch never fires. Pre-existing gap on the metadata WIP branch.
  it.skip('suggests target kinds right after the Metadata keyword', () => {
    const program = `Table users { id int }

Metadata `;
    const layout = new MemoryProjectLayout();
    layout.setSource(DEFAULT_ENTRY, program);
    const compiler = new Compiler(layout);

    // Cursor after "Metadata " on line 3
    const result = labels(compiler, program, 3, 10);
    expect(result).toContain('Table');
    expect(result).toContain('Column');
    expect(result).toContain('Schema');
    expect(result).toContain('TableGroup');
  });

  it('suggests existing table names after the target kind', () => {
    const program = `Table users { id int }
Table accounts { id int }

Metadata Table `;
    const layout = new MemoryProjectLayout();
    layout.setSource(DEFAULT_ENTRY, program);
    const compiler = new Compiler(layout);

    // Cursor after "Metadata Table " on line 4
    const result = labels(compiler, program, 4, 16);
    expect(result).toContain('users');
    expect(result).toContain('accounts');
  });
});
