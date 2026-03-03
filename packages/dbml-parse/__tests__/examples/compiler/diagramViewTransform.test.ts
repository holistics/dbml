import { describe, expect, test } from 'vitest';
import { createDiagramView, updateDiagramView, renameDiagramView, deleteDiagramView, migrateViewsToDbml, syncDiagramViews } from '@dbml/core';

const BASE_DBML = `
Table users {
  id int [pk]
}

Table orders {
  id int [pk]
  user_id int
}
`;

describe('[example] DiagramView transformation APIs', () => {
  describe('createDiagramView', () => {
    test('should create a new DiagramView block with tables', () => {
      const result = createDiagramView('my_view', ['users', 'orders'], BASE_DBML);
      expect(result).toContain('DiagramView my_view');
      expect(result).toContain('users');
      expect(result).toContain('orders');
    });

    test('should add DiagramView at end of existing content', () => {
      const result = createDiagramView('new_view', ['users'], BASE_DBML);
      // The DiagramView should be added at the end
      expect(result).toContain('DiagramView new_view');
      // Verify it appears after the tables
      const lastTableIndex = result.lastIndexOf('Table orders');
      const viewIndex = result.indexOf('DiagramView new_view');
      expect(viewIndex).toBeGreaterThan(lastTableIndex);
    });
  });

  describe('updateDiagramView', () => {
    test('should update existing DiagramView block (change tables)', () => {
      const dbmlWithView = BASE_DBML + `
DiagramView existing_view {
  users
}
`;
      const result = updateDiagramView('existing_view', ['orders'], dbmlWithView);
      expect(result).toContain('DiagramView existing_view');
      expect(result).toContain('orders');
    });
  });

  describe('renameDiagramView', () => {
    test('should rename existing DiagramView block', () => {
      const dbmlWithView = BASE_DBML + `
DiagramView old_view_name {
  users
}
`;
      const result = renameDiagramView('old_view_name', 'new_view_name', dbmlWithView);
      expect(result).toContain('DiagramView new_view_name');
      expect(result).not.toContain('DiagramView old_view_name');
    });
  });

  describe('deleteDiagramView', () => {
    test('should delete existing DiagramView block', () => {
      const dbmlWithView = BASE_DBML + `
DiagramView view_to_delete {
  users
}
`;
      const result = deleteDiagramView('view_to_delete', dbmlWithView);
      expect(result).not.toContain('DiagramView view_to_delete');
      expect(result).toContain('Table users');
      expect(result).toContain('Table orders');
    });
  });

  describe('migrateViewsToDbml', () => {
    test('should create DiagramView blocks for multiple database views', () => {
      const dbViews = [
        { name: 'view1', tables: ['users'] },
        { name: 'view2', tables: ['orders', 'users'] },
      ];
      const result = migrateViewsToDbml(dbViews, BASE_DBML);
      expect(result).toContain('DiagramView view1');
      expect(result).toContain('DiagramView view2');
      expect(result).toContain('users');
      expect(result).toContain('orders');
    });
  });

  describe('syncDiagramViews', () => {
    const emptyDbml = `
Table users {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  user_id int
}
`;

    test('should create a new DiagramView block', () => {
      const operation = {
        type: 'create' as const,
        newName: 'user_view',
        filterConfig: {
          tables: [{ name: 'users', schemaName: '' }],
          schemas: null,
          tableGroups: null,
          stickyNotes: null,
        },
      };
      const result = syncDiagramViews(operation, [], emptyDbml);
      expect(result).toContain('DiagramView user_view');
      expect(result).toContain('tables {');
      expect(result).toContain('users');
    });

    test('should update an existing DiagramView block', () => {
      const dbmlWithView = emptyDbml + '\n\nDiagramView user_view {\n  tables {\n    users\n  }\n}';
      const operation = {
        type: 'update' as const,
        newName: 'user_view',
        filterConfig: {
          tables: [{ name: 'users', schemaName: '' }, { name: 'posts', schemaName: '' }],
          schemas: null,
          tableGroups: null,
          stickyNotes: null,
        },
      };
      const result = syncDiagramViews(operation, [], dbmlWithView);
      expect(result).toMatch(/DiagramView user_view\s*\{[^}]*tables\s*\{[^}]*users[^}]*posts[^}]*\}/s);
    });

    test('should rename an existing DiagramView block', () => {
      const dbmlWithView = emptyDbml + '\n\nDiagramView old_view {\n  tables {\n    users\n  }\n}';
      const operation = {
        type: 'rename' as const,
        oldName: 'old_view',
        newName: 'new_view',
      };
      const result = syncDiagramViews(operation, [], dbmlWithView);
      expect(result).toContain('DiagramView new_view');
      expect(result).not.toContain('DiagramView old_view');
    });

    test('should only apply explicit operation - no auto-migration', () => {
      // With auto-migration removed, only the explicitly requested operation should be applied
      const dbViews = [
        { name: 'user_view', visibleEntities: { tables: [{ name: 'users', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null } },
        { name: 'post_view', visibleEntities: { tables: [{ name: 'posts', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null } },
      ];
      const operation = {
        type: 'create' as const,
        newName: 'new_view',
        filterConfig: { tables: [{ name: 'users', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null },
      };
      const result = syncDiagramViews(operation, dbViews, emptyDbml);
      // Should only have the explicitly created view, not auto-migrated ones
      expect(result).toContain('DiagramView new_view');
      expect(result).not.toContain('DiagramView user_view');
      expect(result).not.toContain('DiagramView post_view');
    });

    test('should not migrate if DB view already exists in DBML', () => {
      const dbmlWithView = emptyDbml + '\n\nDiagramView existing_view {\n  tables {\n    users\n  }\n}';
      const dbViews = [
        { name: 'existing_view', visibleEntities: { tables: [{ name: 'users', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null } },
      ];
      const operation = {
        type: 'create' as const,
        newName: 'new_view',
        filterConfig: { tables: [], schemas: null, tableGroups: null, stickyNotes: null },
      };
      const result = syncDiagramViews(operation, dbViews, dbmlWithView);
      // Should only have 2 DiagramView blocks, not duplicate existing_view
      const viewMatches = result.match(/DiagramView\s+\w+/g);
      expect(viewMatches?.length).toBe(2);
    });

    test('should handle full FilterConfig with all entity types', () => {
      const operation = {
        type: 'create' as const,
        newName: 'full_view',
        filterConfig: {
          tables: [{ name: 'users', schemaName: 'core' }, { name: 'posts', schemaName: '' }],
          schemas: [{ name: 'core' }],
          tableGroups: [{ name: 'blog' }],
          stickyNotes: [{ name: 'reminder' }],
        },
      };
      const result = syncDiagramViews(operation, [], emptyDbml);
      expect(result).toContain('DiagramView full_view');
      expect(result).toContain('core.users');
      expect(result).toContain('posts');
      expect(result).toContain('schemas {');
      expect(result).toContain('core');
      expect(result).toContain('tableGroups {');
      expect(result).toContain('blog');
      expect(result).toContain('notes {');
      expect(result).toContain('reminder');
    });

    test('should NOT auto-migrate views - frontend decides operation', () => {
      // Only the explicitly requested operation should be applied
      const dbmlWithView = emptyDbml + '\n\nDiagramView existing_view {\n  tables {\n    users\n  }\n}';
      const dbViews = [
        { name: 'existing_view', visibleEntities: { tables: [{ name: 'users', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null } },
        { name: 'unrelated_view', visibleEntities: { tables: [{ name: 'posts', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null } },
      ];
      const operation = {
        type: 'update' as const,
        newName: 'existing_view',
        filterConfig: { tables: [{ name: 'posts', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null },
      };
      const result = syncDiagramViews(operation, dbViews, dbmlWithView);
      // Should only have 1 DiagramView block - the update should NOT create unrelated_view
      const viewMatches = result.match(/DiagramView\s+(?:"[^"]+"|\w+)/g);
      expect(viewMatches?.length).toBe(1);
      expect(result).toContain('DiagramView existing_view');
      expect(result).not.toContain('DiagramView unrelated_view');
    });
  });

  describe('quoted view names with spaces', () => {
    const emptyDbml = `
Table users {
  id int [pk]
  name varchar
}

Table posts {
  id int [pk]
  user_id int
}
`;

    test('should create DiagramView with quoted name when name has spaces', () => {
      const result = createDiagramView('Test View', ['users'], BASE_DBML);
      expect(result).toContain('DiagramView "Test View"');
    });

    test('should find and update DiagramView with quoted name', () => {
      const dbmlWithQuotedView = BASE_DBML + `
DiagramView "Test View" {
  tables {
    users
  }
}
`;
      const result = updateDiagramView('Test View', ['orders'], dbmlWithQuotedView);
      expect(result).toContain('DiagramView "Test View"');
      expect(result).toContain('orders');
      // Verify the DiagramView block specifically doesn't have 'users' (not the Table definitions)
      const viewBlockMatch = result.match(/DiagramView "Test View" \{[\s\S]*?\}/);
      expect(viewBlockMatch?.[0]).not.toContain('users');
    });

    test('should find and rename DiagramView with quoted name', () => {
      const dbmlWithQuotedView = BASE_DBML + `
DiagramView "Old Name" {
  tables {
    users
  }
}
`;
      const result = renameDiagramView('Old Name', 'New Name', dbmlWithQuotedView);
      expect(result).toContain('DiagramView "New Name"');
      expect(result).not.toContain('DiagramView "Old Name"');
    });

    test('should handle mixed quoted and unquoted names', () => {
      const dbmlWithMixedViews = BASE_DBML + `
DiagramView simple_view {
  tables { users }
}

DiagramView "View With Spaces" {
  tables { orders }
}
`;
      // Update simple_view
      let result = updateDiagramView('simple_view', ['orders'], dbmlWithMixedViews);
      // Update quoted name
      result = updateDiagramView('View With Spaces', ['users'], result);
      // Should have exactly 2 DiagramView blocks, no duplicates
      const viewMatches = result.match(/DiagramView\s+(?:"[^"]+"|\w+)/g);
      expect(viewMatches?.length).toBe(2);
    });

    test('syncDiagramViews should not create duplicates with quoted names', () => {
      const dbmlWithView = emptyDbml + '\n\nDiagramView "Test View" {\n  tables {\n    users\n  }\n}';
      const dbViews = [
        { name: 'Test View', visibleEntities: { tables: [{ name: 'users', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null } },
      ];
      const operation = {
        type: 'update' as const,
        newName: 'Test View',
        filterConfig: { tables: [{ name: 'posts', schemaName: '' }], schemas: null, tableGroups: null, stickyNotes: null },
      };
      const result = syncDiagramViews(operation, dbViews, dbmlWithView);
      // Should only have 1 DiagramView block, no duplicates
      const viewMatches = result.match(/DiagramView\s+(?:"[^"]+"|\w+)/g);
      expect(viewMatches?.length).toBe(1);
    });
  });
});
