import { describe, expect, test } from 'vitest';
import { interpret } from '@tests/utils';

describe('[example] DiagramView new colon syntax parsing', () => {
  const baseTables = `
    Table users { id int }
    Table orders { id int }
    Table products { id int }
  `;

  describe('colon syntax with list', () => {
    test('should parse Tables: [t1, t2] with specific tables', () => {
      const source = `${baseTables}
        DiagramView my_view: [users, orders]
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('my_view');
      expect(view.visibleEntities.tables).toEqual([
        { name: 'users', schemaName: '' },
        { name: 'orders', schemaName: '' },
      ]);
      // Other categories should be null (show all)
      expect(view.visibleEntities.schemas).toBeNull();
      expect(view.visibleEntities.tableGroups).toBeNull();
      expect(view.visibleEntities.stickyNotes).toBeNull();
    });

    test('should parse Tables: [] to show nothing', () => {
      const source = `${baseTables}
        DiagramView empty_view: []
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('empty_view');
      expect(view.visibleEntities.tables).toEqual([]);
    });

    test('should parse Tables: all to show all tables', () => {
      const source = `${baseTables}
        DiagramView all_view: all
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('all_view');
      expect(view.visibleEntities.tables).toBeNull();
    });
  });

  describe('empty body handling', () => {
    test('should parse DiagramView name {} (empty body) to show nothing', () => {
      const source = `${baseTables}
        DiagramView empty_view {}
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      if (errors.length > 0) {
        console.log('Parse errors:', errors.map(e => e.diagnostic));
      }
      const db = result.getValue();

      expect(db).toBeDefined();
      expect(db?.diagramViews).toHaveLength(1);
      const view = db!.diagramViews[0];
      expect(view.name).toBe('empty_view');
      // Empty body should result in all categories = [] (show nothing)
      expect(view.visibleEntities.tables).toEqual([]);
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });

    test('should parse DiagramView name (no body) to show all', () => {
      const source = `${baseTables}
        DiagramView no_body_view { }
      `;
      const result = interpret(source);
      const errors = result.getErrors();
      if (errors.length > 0) {
        console.log('Parse errors:', errors.map(e => e.diagnostic));
      }
      const db = result.getValue();

      expect(db).toBeDefined();
      expect(db?.diagramViews).toHaveLength(1);
      const view = db!.diagramViews[0];
      expect(view.name).toBe('no_body_view');
      // Empty body should result in all categories = [] (show nothing)
      expect(view.visibleEntities.tables).toEqual([]);
      expect(view.visibleEntities.schemas).toEqual([]);
      expect(view.visibleEntities.tableGroups).toEqual([]);
      expect(view.visibleEntities.stickyNotes).toEqual([]);
    });
  });

  describe('backward compatibility with block syntax', () => {
    test('should still parse Tables { } (empty block) as empty array', () => {
      const source = `${baseTables}
        DiagramView empty_block_view {
          tables { }
        }
      `;
      const db = interpret(source).getValue()!;

      expect(db.diagramViews).toHaveLength(1);
      const view = db.diagramViews[0];
      expect(view.name).toBe('empty_block_view');
      expect(view.visibleEntities.tables).toEqual([]);
    });
  });
});
