import { describe, expect, it } from 'vitest';
import Compiler from '@/compiler';
import DBMLCompletionItemProvider from '@/services/suggestions/provider';
import { DEFAULT_ENTRY } from '@/constants';
import { MemoryProjectLayout } from '@/compiler/projectLayout/layout';
import { createMockTextModel, createPosition } from '../../../utils';

function suggestionLabels (program: string, line: number, column: number) {
  const layout = new MemoryProjectLayout();
  layout.setSource(DEFAULT_ENTRY, program);
  const provider = new DBMLCompletionItemProvider(new Compiler(layout));
  return provider.provideCompletionItems(createMockTextModel(program), createPosition(line, column)).suggestions.map((s) => s.label);
}

// `Metadata TableGroup|Note <name>` accepts a schema-qualified name, so the schema is suggested along with the target names
describe('[example] Metadata header name suggestions', () => {
  it('suggests schemas and table groups after `Metadata TableGroup`', () => {
    const program = `Table s.users {
  id int
}

TableGroup s.g1 {
  s.users
}

TableGroup g2 {
}

Metadata TableGroup `;
    const labels = suggestionLabels(program, 12, 21);
    expect(labels).toContain('s');
    expect(labels).toContain('g2');
  });

  it('suggests schemas and sticky notes after `Metadata Note`', () => {
    const program = `Table s.users {
  id int
}

Note s.n1 {
  'text'
}

Note n2 {
  'text'
}

Metadata Note `;
    const labels = suggestionLabels(program, 13, 15);
    expect(labels).toContain('s');
    expect(labels).toContain('n2');
  });
});
