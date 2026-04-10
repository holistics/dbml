import { describe, expect, it } from 'vitest';
import { syncDiagramView } from '@/compiler/queries/transform/syncDiagramView';
import Compiler from '@/compiler/index';
import Lexer from '@/core/lexer/lexer';
import { DEFAULT_ENTRY } from '@/constants';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator } from '@/core/parser/nodes';

// update operation

describe('syncDiagramView - update', () => {
  it('renames an existing DiagramView block', () => {
    const dbml = `
DiagramView my_view {
  Tables { users }
}`;
    const { newDbml } = syncDiagramView(dbml, [
      { operation: 'update', name: 'my_view', newName: 'renamed_view' },
    ]);
    expect(newDbml).toContain('DiagramView renamed_view');
    expect(newDbml).not.toContain('DiagramView my_view');
  });
});

// delete operation

describe('syncDiagramView - delete', () => {
  it('removes an existing DiagramView block', () => {
    const dbml = `
Table users {
  id int
}

DiagramView my_view {
  Tables { users }
}
`;
    const { newDbml } = syncDiagramView(dbml, [
      { operation: 'delete', name: 'my_view' },
    ]);
    expect(newDbml).not.toContain('DiagramView my_view');
    expect(newDbml).toContain('Table users');
  });
});

// wildcard in diagram view

describe('Parser - * wildcard in DiagramView', () => {
  it('parses DiagramView with { * } without errors', () => {
    const source = 'DiagramView v { * }';
    const tokens = new Lexer(source, DEFAULT_ENTRY).lex().getValue();
    const result = new Parser(source, tokens, new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
    expect(result.getErrors()).toHaveLength(0);
  });

  it('parses DiagramView Tables { * } without errors', () => {
    const source = `
DiagramView v {
  Tables {
    * 
  }
}
`;
    const tokens = new Lexer(source, DEFAULT_ENTRY).lex().getValue();
    const result = new Parser(source, tokens, new SyntaxNodeIdGenerator(), DEFAULT_ENTRY).parse();
    expect(result.getErrors()).toHaveLength(0);
  });

  it('validates DiagramView with multiple sub-blocks each using * without errors', () => {
    const source = `
DiagramView "New View" {
  Tables { * }
  Notes { * }
  TableGroups { * }
  Schemas { * }
}
`;
    const compiler = new Compiler();
    compiler.setSource(source);
    expect(compiler.parse.errors()).toHaveLength(0);
  });
});

// Quote name

describe('syncDiagramView - name quoting', () => {
  it('quotes names containing spaces', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'My View',
        visibleEntities: { tables: null, stickyNotes: null, tableGroups: null, schemas: null },
      },
    ]);
    expect(newDbml).toContain('DiagramView "My View"');
  });

  it('does not quote simple identifier names', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'my_view',
        visibleEntities: { tables: null, stickyNotes: null, tableGroups: null, schemas: null },
      },
    ]);
    expect(newDbml).toContain('DiagramView my_view');
    expect(newDbml).not.toContain('"my_view"');
  });

  it('escapes internal double quotes in names', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'My "Special" View',
        visibleEntities: { tables: null, stickyNotes: null, tableGroups: null, schemas: null },
      },
    ]);
    expect(newDbml).toContain('DiagramView "My \\"Special\\" View"');
  });

  it('can find and update a block with a quoted name', () => {
    const dbml = `
DiagramView "My View" {
  Tables { users }
}
`;
    const { newDbml } = syncDiagramView(dbml, [
      { operation: 'update', name: 'My View', newName: 'New Name' },
    ]);
    expect(newDbml).toContain('DiagramView "New Name"');
    expect(newDbml).not.toContain('"My View"');
  });
});

// idempotent create

describe('syncDiagramView - idempotent create', () => {
  it('treats create as update when block with same name already exists', () => {
    const dbml = `
DiagramView my_view {
  Tables { users }
}
`;
    const { newDbml } = syncDiagramView(dbml, [
      {
        operation: 'create',
        name: 'my_view',
        visibleEntities: {
          tables: [{ name: 'posts', schemaName: 'public' }],
          stickyNotes: null,
          tableGroups: null,
          schemas: null,
        },
      },
    ]);
    // Should not create a second DiagramView block
    const matches = [...newDbml.matchAll(/DiagramView my_view/g)];
    expect(matches).toHaveLength(1);
    // Should have updated content with posts
    expect(newDbml).toContain('posts');
  });
});
