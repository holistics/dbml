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

// Additional coverage from filter-dbml-examples.md + edge cases

describe('syncDiagramView — additional coverage', () => {
  // Edge cases from truth tables (02-solutions.md)

  it('all Trinity null + stickyNotes has items → Notes { items }', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null, tableGroups: null, schemas: null, stickyNotes: [{ name: 'Note1' }],
        },
      },
    ]);
    expect(newDbml).toContain('Notes {');
    expect(newDbml).toContain('Note1');
    expect(newDbml).not.toContain('Tables');
    expect(newDbml).not.toContain('TableGroups');
    expect(newDbml).not.toContain('Schemas');
  });

  it('tables null + notes has items → Notes { items }', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null, tableGroups: [], schemas: [], stickyNotes: [{ name: 'Note1' }],
        },
      },
    ]);
    expect(newDbml).toContain('Notes {');
    expect(newDbml).toContain('Note1');
    expect(newDbml).not.toContain('Tables {');
    expect(newDbml).not.toContain('TableGroups');
    expect(newDbml).not.toContain('Schemas');
  });

  // Schema-qualified table names

  it('emits schema-qualified table names for non-public schemas', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'myschema' }],
          tableGroups: [],
          schemas: [],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('myschema.users');
    expect(newDbml).not.toContain('public.');
  });

  it('omits public schema prefix for default schema tables', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }],
          tableGroups: [],
          schemas: [],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('users');
    expect(newDbml).not.toContain('public.users');
  });

  // Round-trip stability: FilterConfig → DBML → FilterConfig

  it('round-trip: B1 all empty → { *} → re-parse → same FC', () => {
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

  it('round-trip: A1 all null → { } → re-parse → same FC', () => {
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

  it('round-trip: C1 notes only → Tables{*} Notes{items} → re-parse → same FC', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [], tableGroups: [], schemas: [], stickyNotes: [{ name: 'N1' }],
        },
      },
    ]);
    expect(newDbml).toContain('Tables { * }');
    expect(newDbml).toContain('Notes {');
    expect(newDbml).toContain('N1');
  });

  it('round-trip: A10 all Trinity null + notes empty → Notes { * }', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null, tableGroups: null, schemas: null, stickyNotes: [],
        },
      },
    ]);
    expect(newDbml.trim()).toBe('DiagramView V {\n  Notes { * }\n}');
  });

  // Multiple items in sub-blocks

  it('emits multiple tables in Tables block', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [
            { name: 'users', schemaName: 'public' },
            { name: 'orders', schemaName: 'public' },
            { name: 'products', schemaName: 'public' },
          ],
          tableGroups: [],
          schemas: [],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('users');
    expect(newDbml).toContain('orders');
    expect(newDbml).toContain('products');
  });

  it('emits multiple tableGroups in TableGroups block', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [],
          tableGroups: [{ name: 'Inv' }, { name: 'Rep' }, { name: 'Auth' }],
          schemas: [],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('Inv');
    expect(newDbml).toContain('Rep');
    expect(newDbml).toContain('Auth');
  });

  // Union rule with notes

  it('A8 union rule: tables null + tableGroups + schemas + notes → emit all three', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: null,
          tableGroups: [{ name: 'Inv' }],
          schemas: [{ name: 'sales' }],
          stickyNotes: [{ name: 'Note1' }],
        },
      },
    ]);
    expect(newDbml).toContain('TableGroups {');
    expect(newDbml).toContain('Inv');
    expect(newDbml).toContain('Schemas {');
    expect(newDbml).toContain('sales');
    expect(newDbml).toContain('Notes {');
    expect(newDbml).toContain('Note1');
    expect(newDbml).not.toContain('Tables {');
  });

  // Delete operation still works after changes

  it('delete operation removes the block', () => {
    const dbml = `
Table users { id int }

DiagramView my_view {
  Tables { users }
}
`;
    const { newDbml } = syncDiagramView(dbml, [
      { operation: 'delete', name: 'my_view' },
    ]);
    expect(newDbml).not.toContain('DiagramView');
    expect(newDbml).toContain('Table users');
  });

  // Update operation replaces block content

  it('update operation replaces visibleEntities', () => {
    const dbml = `
DiagramView my_view {
  Tables { users }
}
`;
    const { newDbml } = syncDiagramView(dbml, [
      {
        operation: 'update',
        name: 'my_view',
        visibleEntities: {
          tables: [],
          tableGroups: [{ name: 'Inv' }],
          schemas: [],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).not.toContain('users');
    expect(newDbml).toContain('TableGroups {');
    expect(newDbml).toContain('Inv');
  });
});

// Entity name quoting (spaces, special chars, digits, inner quotes)

describe('syncDiagramView - entity name quoting', () => {
  // Tables

  it('quotes table names with spaces', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'Order Details', schemaName: 'public' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"Order Details"');
    // Verify it's quoted, not bare
    expect(newDbml).not.toMatch(/Tables {\n\s+Order Details\n/);
  });

  it('quotes table names with hyphens', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'user-table', schemaName: 'public' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"user-table"');
  });

  it('quotes table names starting with digit', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: '123table', schemaName: 'public' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"123table"');
  });

  it('escapes inner double quotes in table names', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'say "hello"', schemaName: 'public' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"say \\"hello\\""');
  });

  it('quotes schema name when it has spaces', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'my schema' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"my schema".users');
  });

  it('quotes both schema and table when both have spaces', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'Order Details', schemaName: 'Sales Data' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"Sales Data"."Order Details"');
  });

  it('does not quote simple table names', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: 'public' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('users');
    expect(newDbml).not.toContain('"users"');
  });

  // TableGroups

  it('quotes tableGroup names with spaces', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [],
          tableGroups: [{ name: 'Inventory Group' }, { name: 'Reporting' }],
          schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"Inventory Group"');
    expect(newDbml).toContain('Reporting');
    expect(newDbml).not.toContain('"Reporting"');
  });

  it('quotes tableGroup names with special characters', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [],
          tableGroups: [{ name: 'my-group!' }],
          schemas: [], stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"my-group!"');
  });

  // Schemas

  it('quotes schema names with spaces', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [],
          tableGroups: [],
          schemas: [{ name: 'Sales Data' }, { name: 'analytics' }],
          stickyNotes: [],
        },
      },
    ]);
    expect(newDbml).toContain('"Sales Data"');
    expect(newDbml).toContain('analytics');
    expect(newDbml).not.toContain('"analytics"');
  });

  // Sticky Notes

  it('quotes stickyNote names with spaces', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [], tableGroups: [], schemas: [],
          stickyNotes: [{ name: 'Important Note' }, { name: 'reminder' }],
        },
      },
    ]);
    expect(newDbml).toContain('"Important Note"');
    expect(newDbml).toContain('reminder');
    expect(newDbml).not.toContain('"reminder"');
  });

  it('escapes inner double quotes in stickyNote names', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [], tableGroups: [], schemas: [],
          stickyNotes: [{ name: 'note "A"' }],
        },
      },
    ]);
    expect(newDbml).toContain('"note \\"A\\""');
  });

  // Round-trip: quoted names parse back correctly

  it('round-trip: quoted table name re-parses without errors', () => {
    const existingDbml = `Table "Order Details" { id int }`;
    const { newDbml } = syncDiagramView(existingDbml, [
      {
        operation: 'create',
        name: 'V',
        visibleEntities: {
          tables: [{ name: 'Order Details', schemaName: 'public' }],
          tableGroups: [], schemas: [], stickyNotes: [],
        },
      },
    ]);
    const compiler = new Compiler();
    compiler.setSource(newDbml);
    expect(compiler.parse.errors()).toHaveLength(0);
  });

  it('round-trip: all entity types with special names produce correct DBML output', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'My View',
        visibleEntities: {
          tables: [{ name: 'Order Details', schemaName: 'Sales Data' }],
          tableGroups: [{ name: 'my-group' }],
          schemas: [{ name: '123schema' }],
          stickyNotes: [{ name: 'Important Note' }],
        },
      },
    ]);
    expect(newDbml).toContain('DiagramView "My View"');
    expect(newDbml).toContain('"Sales Data"."Order Details"');
    expect(newDbml).toContain('"my-group"');
    expect(newDbml).toContain('"123schema"');
    expect(newDbml).toContain('"Important Note"');
  });
});
