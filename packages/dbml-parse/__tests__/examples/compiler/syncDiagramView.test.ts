import { describe, expect, it } from 'vitest';
import { syncDiagramView } from '@/compiler/queries/transform/syncDiagramView';
import Compiler from '@/compiler/index';
import Lexer from '@/core/lexer/lexer';
import { DEFAULT_ENTRY } from '@/constants';
import Parser from '@/core/parser/parser';
import { SyntaxNodeIdGenerator } from '@/core/types/nodes';

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
    const result = new Parser(DEFAULT_ENTRY, source, tokens, new SyntaxNodeIdGenerator()).parse();
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
    const result = new Parser(DEFAULT_ENTRY, source, tokens, new SyntaxNodeIdGenerator()).parse();
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
    compiler.setSource(DEFAULT_ENTRY, source);
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

// ─── syncDiagramView across multifile content ────────────────────────────────

describe('syncDiagramView - multifile scenarios', () => {
  it('appends a new view to a file that imports tables from another file', () => {
    const dbml = `use { table users } from './base.dbml'

Table orders {
  id int [pk]
}
`;
    const { newDbml } = syncDiagramView(dbml, [
      {
        operation: 'create',
        name: 'overview',
        visibleEntities: {
          tables: [{ name: 'users', schemaName: null }, { name: 'orders', schemaName: null }],
          stickyNotes: null,
          tableGroups: null,
          schemas: null,
        },
      },
    ]);
    expect(newDbml).toContain('DiagramView overview');
    expect(newDbml).toContain('users');
    expect(newDbml).toContain('orders');
    expect(newDbml).toContain("use { table users } from './base.dbml'");
  });

  it('deletes a view without touching import statements', () => {
    const dbml = `use { table users } from './base.dbml'

DiagramView old_view {
  Tables { users }
}
`;
    const { newDbml } = syncDiagramView(dbml, [
      { operation: 'delete', name: 'old_view' },
    ]);
    expect(newDbml).not.toContain('DiagramView old_view');
    expect(newDbml).toContain("use { table users } from './base.dbml'");
  });

  it('renames a view in a file that has both imports and local tables', () => {
    const dbml = `use { table users } from './base.dbml'

Table orders { id int [pk] }

DiagramView main {
  Tables { users }
}
`;
    const { newDbml } = syncDiagramView(dbml, [
      { operation: 'update', name: 'main', newName: 'dashboard' },
    ]);
    expect(newDbml).toContain('DiagramView dashboard');
    expect(newDbml).not.toContain('DiagramView main');
    expect(newDbml).toContain("use { table users }");
    expect(newDbml).toContain('Table orders');
  });

  it('applies sequential create then delete operations', () => {
    const dbml = 'Table users { id int [pk] }';
    const { newDbml } = syncDiagramView(dbml, [
      {
        operation: 'create',
        name: 'temp_view',
        visibleEntities: { tables: null, stickyNotes: null, tableGroups: null, schemas: null },
      },
      { operation: 'delete', name: 'temp_view' },
    ]);
    expect(newDbml).not.toContain('DiagramView temp_view');
    expect(newDbml).toContain('Table users');
  });

  it('handles create + rename in the same batch', () => {
    const dbml = 'Table users { id int [pk] }';
    const { newDbml } = syncDiagramView(dbml, [
      {
        operation: 'create',
        name: 'v1',
        visibleEntities: { tables: null, stickyNotes: null, tableGroups: null, schemas: null },
      },
      { operation: 'update', name: 'v1', newName: 'v2' },
    ]);
    expect(newDbml).toContain('DiagramView v2');
    expect(newDbml).not.toContain('DiagramView v1');
  });

  it('create with tables subblock serialises table names correctly', () => {
    const { newDbml } = syncDiagramView('', [
      {
        operation: 'create',
        name: 'overview',
        visibleEntities: {
          tables: [{ name: 'users' }, { name: 'orders' }],
          stickyNotes: null,
          tableGroups: null,
          schemas: null,
        },
      },
    ]);
    expect(newDbml).toContain('Tables {');
    expect(newDbml).toContain('users');
    expect(newDbml).toContain('orders');
  });
});
