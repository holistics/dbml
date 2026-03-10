import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example] DiagramView new block syntax parsing', () => {
  const baseTables = `
    Table users { id int [pk] }
    Table posts { id int [pk] }
    Note reminder { 'Remember to add indexes' }
    TableGroup blog {
      users
      posts
    }
  `;

  describe('Tables: {*} — show all tables', () => {
    test('should parse Tables: {*} as tables = null (show all)', () => {
      const source = `${baseTables}
        DiagramView my_view {
          Tables: {*}
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('my_view');
      // Tables: {*} means show all tables => null
      expect(view.visibleEntities.tables).toBeNull();
      // Omitted categories default to []
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });
  });

  describe('specific items in category blocks', () => {
    test('should parse Tables { users posts } as specific table list', () => {
      const source = `${baseTables}
        DiagramView specific_view {
          Tables {
            users
            posts
          }
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('specific_view');
      expect(view.visibleEntities.tables).toEqual([
        { name: 'users', schemaName: null },
        { name: 'posts', schemaName: null },
      ]);
      // Omitted categories default to []
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });

    test('should parse Notes { reminder } as specific note list', () => {
      const source = `${baseTables}
        DiagramView notes_view {
          Notes {
            reminder
          }
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('notes_view');
      expect(view.visibleEntities.stickyNotes).toEqual([{ name: 'reminder' }]);
      // Omitted categories default to []
      expect(view.visibleEntities.tables).toEqual([]);
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
    });

    test('should parse TableGroups { blog } as specific table group list', () => {
      const source = `${baseTables}
        DiagramView tg_view {
          TableGroups {
            blog
          }
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('tg_view');
      expect(view.visibleEntities.tableGroups).toEqual([{ name: 'blog' }]);
      // Omitted categories default to []
      expect(view.visibleEntities.tables).toEqual([]);
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });

    test('should parse mixed categories with specific items', () => {
      const source = `${baseTables}
        DiagramView mixed_view {
          Tables {
            users
          }
          Notes {
            reminder
          }
          TableGroups {
            blog
          }
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('mixed_view');
      expect(view.visibleEntities.tables).toEqual([{ name: 'users', schemaName: null }]);
      expect(view.visibleEntities.stickyNotes).toEqual([{ name: 'reminder' }]);
      expect(view.visibleEntities.tableGroups).toEqual([{ name: 'blog' }]);
      expect(view.visibleEntities.schemas).toEqual([]);
    });
  });

  describe('empty category blocks — show nothing', () => {
    test('should parse Tables {} as tables = [] (show nothing)', () => {
      const source = `${baseTables}
        DiagramView empty_tables_view {
          Tables {}
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('empty_tables_view');
      expect(view.visibleEntities.tables).toEqual([]);
    });

    test('should parse all empty category blocks as all = []', () => {
      const source = `${baseTables}
        DiagramView show_nothing {
          Tables {}
          Notes {}
          TableGroups {}
          Schemas {}
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('show_nothing');
      expect(view.visibleEntities.tables).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.schemas).toEqual([]);
    });
  });

  describe('top-level * — show all everything', () => {
    test('should parse DiagramView { * } as all categories = null', () => {
      const source = `${baseTables}
        DiagramView all_view {
          *
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('all_view');
      expect(view.visibleEntities.tables).toBeNull();
      expect(view.visibleEntities.schemas).toBeNull();
      expect(view.visibleEntities.tableGroups).toBeNull();
      expect(view.visibleEntities.stickyNotes).toBeNull();
    });
  });

  describe('empty body and no body — show nothing', () => {
    test('should parse DiagramView name {} (empty body) as all categories = []', () => {
      const source = `${baseTables}
        DiagramView empty_body {}
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('empty_body');
      expect(view.visibleEntities.tables).toEqual([]);
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });

    test('should parse DiagramView name (no body) without crashing', () => {
      // DiagramView with no body at all — the parser may produce errors but should not crash.
      // Per spec, this is equivalent to all categories = [] (show nothing).
      const source = `Table users { id int }
DiagramView no_body_view
Table posts { id int }
`;
      const result = interpret(source);
      // The result may have errors, but we just verify it doesn't throw
      // and the db value is usable if defined
      const db = result.getValue();
      if (db) {
        const view = db.diagramViews?.find((v: any) => v.name === 'no_body_view');
        if (view) {
          expect(view.visibleEntities.tables).toEqual([]);
          expect(view.visibleEntities.schemas).toEqual([]);
          expect(view.visibleEntities.tableGroups).toEqual([]);
          expect(view.visibleEntities.stickyNotes).toEqual([]);
        }
      }
      // At minimum the interpret call should not throw
      expect(result).toBeDefined();
    });
  });

  describe('multiple DiagramViews', () => {
    test('should parse multiple DiagramView blocks', () => {
      const source = `${baseTables}
        DiagramView view_a {
          Tables: {*}
        }
        DiagramView view_b {
          Tables {
            users
          }
        }
        DiagramView view_c {}
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(3);

      const viewA = db.diagramViews[0];
      expect(viewA.name).toBe('view_a');
      expect(viewA.visibleEntities.tables).toBeNull();

      const viewB = db.diagramViews[1];
      expect(viewB.name).toBe('view_b');
      expect(viewB.visibleEntities.tables).toEqual([{ name: 'users', schemaName: null }]);

      const viewC = db.diagramViews[2];
      expect(viewC.name).toBe('view_c');
      expect(viewC.visibleEntities.tables).toEqual([]);
    });
  });
});
