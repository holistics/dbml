import {
  describe, expect, it,
} from 'vitest';
import {
  syncDiagramView,
} from '@/compiler/queries/transform/syncDiagramView';
import Compiler from '@/compiler/index';
import Lexer from '@/core/lexer/lexer';
import {
  DEFAULT_ENTRY,
} from '@/constants';
import Parser from '@/core/parser/parser';
import {
  SyntaxNodeIdGenerator,
} from '@/core/types/nodes';

// update operation

describe('syncDiagramView - update', () => {
  it('renames an existing DiagramView block', () => {
    const dbml = `
DiagramView my_view {
  Tables { users }
}`;
    const {
      newDbml,
    } = syncDiagramView(dbml, [
      {
        operation: 'update',
        name: 'my_view',
        newName: 'renamed_view',
      },
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
    const {
      newDbml,
    } = syncDiagramView(dbml, [
      {
        operation: 'delete',
        name: 'my_view',
      },
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
    const {
      newDbml,
    } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'My View',
        visibleEntities: {
          tables: null,
          stickyNotes: null,
          tableGroups: null,
          schemas: null,
        },
      },
    ]);
    expect(newDbml).toContain('DiagramView "My View"');
  });

  it('does not quote simple identifier names', () => {
    const {
      newDbml,
    } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'my_view',
        visibleEntities: {
          tables: null,
          stickyNotes: null,
          tableGroups: null,
          schemas: null,
        },
      },
    ]);
    expect(newDbml).toContain('DiagramView my_view');
    expect(newDbml).not.toContain('"my_view"');
  });

  it('escapes internal double quotes in names', () => {
    const {
      newDbml,
    } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'My "Special" View',
        visibleEntities: {
          tables: null,
          stickyNotes: null,
          tableGroups: null,
          schemas: null,
        },
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
    const {
      newDbml,
    } = syncDiagramView(dbml, [
      {
        operation: 'update',
        name: 'My View',
        newName: 'New Name',
      },
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
    const {
      newDbml,
    } = syncDiagramView(dbml, [
      {
        operation: 'create',
        name: 'my_view',
        visibleEntities: {
          tables: [
            {
              name: 'posts',
              schemaName: 'public',
            },
          ],
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

// Generation rules from filter-dbml-examples.md

describe('syncDiagramView - generation rules (filter-dbml-examples.md)', () => {
  // Group A: Legacy/Tricky Cases

  it('A1: all null → empty block', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null, tableGroups: null, schemas: null, stickyNotes: null,
        },
      },
    ]);
    expect(newDbml.trim()).toBe('DiagramView V {\n}');
  });

  it('A2: tableGroups null, tables has items (frontend backfills) → emit tables only', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }, { name: 'standalone1', schemaName: 'public' }],
          tableGroups: null,
          schemas: [],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('users');
    expect(newDbml).toContain('standalone1');
    expect(newDbml).not.toContain('TableGroups');
    expect(newDbml).not.toContain('Schemas');
    expect(newDbml).not.toContain('Notes');
  });

  it('A3: tableGroups null, tables + schemas have items → emit both', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }],
          tableGroups: null,
          schemas: [{ name: 'sales' }],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('Schemas {');
    expect(newDbml).toContain('sales');
    expect(newDbml).not.toContain('TableGroups');
    expect(newDbml).not.toContain('Notes');
  });

  it('A5: tables null, rest empty → Notes { * }', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null, tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Notes { * }');
    expect(newDbml).not.toContain('Tables');
    expect(newDbml).not.toContain('TableGroups');
    expect(newDbml).not.toContain('Schemas');
  });

  it('A6: schemas null, rest empty → Notes { * }', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [], tableGroups: [], schemas: null, stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Notes { * }');
  });

  it('A7: tables null + schemas null, tableGroups empty → Notes { * }', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null, tableGroups: [], schemas: null, stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Notes { * }');
  });

  it('A8: tables null with other dims having items → union rule', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null, tableGroups: [{ name: 'Inv' }], schemas: [{ name: 'sales' }], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('TableGroups {');
    expect(newDbml).toContain('Inv');
    expect(newDbml).toContain('Schemas {');
    expect(newDbml).toContain('sales');
    expect(newDbml).not.toContain('Tables {');
  });

  it('A9: schemas null with other dims having items → union rule', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }],
          tableGroups: [{ name: 'Inv' }],
          schemas: null,
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('users');
    expect(newDbml).toContain('TableGroups {');
    expect(newDbml).toContain('Inv');
    expect(newDbml).not.toContain('Schemas {');
  });

  it('A10: all Trinity null, stickyNotes empty → Notes { * }', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null, tableGroups: null, schemas: null, stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Notes { * }');
  });

  // Group B: Normal Cases (all Trinity dims non-null)

  it('B1: all empty → body-level { * }', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [], tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml.trim()).toBe('DiagramView V {\n  *\n}');
  });

  it('B2: only tables filtered → emit Tables only', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }, { name: 'orders', schemaName: 'public' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('users');
    expect(newDbml).toContain('orders');
    expect(newDbml).not.toContain('TableGroups');
    expect(newDbml).not.toContain('Schemas');
    expect(newDbml).not.toContain('Notes');
  });

  it('B3: only tableGroups filtered', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [], tableGroups: [{ name: 'Inventory' }, { name: 'Reporting' }], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('TableGroups {');
    expect(newDbml).toContain('Inventory');
    expect(newDbml).toContain('Reporting');
    expect(newDbml).not.toContain('Tables');
    expect(newDbml).not.toContain('Schemas');
  });

  it('B4: only schemas filtered', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [], tableGroups: [], schemas: [{ name: 'sales' }, { name: 'analytics' }], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Schemas {');
    expect(newDbml).toContain('sales');
    expect(newDbml).not.toContain('Tables');
    expect(newDbml).not.toContain('TableGroups');
  });

  it('B5: tables + schemas', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }],
          tableGroups: [],
          schemas: [{ name: 'sales' }],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('Schemas {');
    expect(newDbml).not.toContain('TableGroups');
  });

  it('B6: tables + tableGroups', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }],
          tableGroups: [{ name: 'Inventory' }],
          schemas: [],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('TableGroups {');
    expect(newDbml).not.toContain('Schemas');
  });

  it('B7: tableGroups + schemas', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [],
          tableGroups: [{ name: 'Inventory' }],
          schemas: [{ name: 'sales' }],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('TableGroups {');
    expect(newDbml).toContain('Schemas {');
    expect(newDbml).not.toContain('Tables');
  });

  it('B8: all three have items', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }],
          tableGroups: [{ name: 'Inventory' }],
          schemas: [{ name: 'sales' }],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('TableGroups {');
    expect(newDbml).toContain('Schemas {');
  });

  // Group C: StickyNotes combinations

  it('C1: only stickyNotes filtered → Tables { * } + Notes', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [], tableGroups: [], schemas: [], stickyNotes: [{ name: 'Note1' }],
        },
      },
    ]);
    expect(newDbml).toContain('Tables { * }');
    expect(newDbml).toContain('Notes {');
    expect(newDbml).toContain('Note1');
    expect(newDbml).not.toContain('TableGroups');
    expect(newDbml).not.toContain('Schemas');
  });

  it('C2: tables + stickyNotes', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }],
          tableGroups: [],
          schemas: [],
          stickyNotes: [{ name: 'Note1' }],
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('users');
    expect(newDbml).toContain('Notes {');
    expect(newDbml).toContain('Note1');
    expect(newDbml).not.toContain('TableGroups');
    expect(newDbml).not.toContain('Schemas');
  });
});
