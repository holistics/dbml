import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import Parser from '../../../src/parse/Parser';
import { MemoryProjectLayout, Filepath } from '@dbml/parse';

const SAMPLES_DIR = path.resolve(__dirname, '../../../../dbml-parse/__tests__/samples');

function loadLayout (projectName: string): MemoryProjectLayout {
  const dir = path.join(SAMPLES_DIR, projectName);
  const layout = new MemoryProjectLayout();

  function walk (d: string) {
    for (const entry of readdirSync(d)) {
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith('.dbml')) {
        const rel = full.slice(dir.length); // e.g. /main.dbml
        layout.setSource(Filepath.from(rel), readFileSync(full, 'utf-8'));
      }
    }
  }

  walk(dir);
  return layout;
}

describe('@dbml/core multifile', () => {
  describe('basic cross-file enum import', () => {
    test('enum-across-files: field type resolves to enum defined in another file', () => {
      const layout = loadLayout('enum-across-files');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const jobs = allTables.find((t) => t.name === 'jobs');
      expect(jobs).toBeDefined();

      const statusField = jobs!.fields.find((f) => f.name === 'status');
      expect(statusField).toBeDefined();
      expect(statusField!.type.type_name).toBe('job_status');
    });

    test('enum-alias: field type resolves via imported enum alias (not original name)', () => {
      const layout = loadLayout('enum-alias');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const jobs = allTables.find((t) => t.name === 'jobs');
      expect(jobs).toBeDefined();

      const statusField = jobs!.fields.find((f) => f.name === 'status');
      expect(statusField).toBeDefined();
      // The alias 'Status' is used in the entry file — not the original 'job_status'
      expect(statusField!.type.type_name).toBe('Status');
    });
  });

  describe('wildcard imports', () => {
    test('wildcard-with-schema-tables: locally-defined table accessible after wildcard import', () => {
      const layout = loadLayout('wildcard-with-schema-tables');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      expect(allTables.map((t) => t.name)).toContain('orders');
    });

    test('wildcard-reuse-chain: only entry-file-defined tables appear; imported tables from reuse chain are absent', () => {
      // BUG: tables imported via reuse * chain (a → b → main via use *) are NOT visible
      // in @dbml/core output, even though @dbml/parse resolves them correctly.
      // users, orders from a.dbml should be visible but are absent.
      const layout = loadLayout('wildcard-reuse-chain');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const tableNames = allTables.map((t) => t.name);

      // 'payments' is locally defined in main.dbml — always visible
      expect(tableNames).toContain('payments');

      // 'users' and 'orders' are from the reuse chain — currently NOT visible through @dbml/core
      // This documents the gap: rawDb() for DEFAULT_ENTRY omits transitively-imported tables
      expect(tableNames).not.toContain('users');
      expect(tableNames).not.toContain('orders');
    });
  });

  describe('mixed imports from same source file', () => {
    test.fails(
      'mixed-import-same-file: importing same symbol twice (selective + wildcard) should be idempotent, not a DUPLICATE_NAME error',
      () => {
        // BUG in @dbml/parse: `use { table users }` followed by `use * from same file`
        // produces DUPLICATE_NAME for 'users' even though it's the same symbol from the same source.
        // Expected: parse succeeds; actual: Parser throws CompilerError with DUPLICATE_NAME.
        const layout = loadLayout('mixed-import-same-file');
        const db = new Parser().parse(layout, 'dbmlv2');

        const allTables = db.schemas.flatMap((s) => s.tables);
        const tableNames = allTables.map((t) => t.name);
        expect(tableNames).toContain('memberships');
        expect(tableNames).toContain('users');
        expect(tableNames).toContain('roles');
      },
    );
  });

  describe('cross-file refs and indexes', () => {
    test.fails(
      'indexes-cross-file: imported table with composite indexes accessible in @dbml/core model',
      () => {
        // BUG in @dbml/core: @dbml/parse correctly exports both 'bookings' (imported) and
        // 'events' (local) along with the ref. But @dbml/core model_structure/endpoint.js
        // throws "Can't find table null.bookings" because it only resolves locally-defined tables.
        // Expected: both tables visible with indexes and ref intact.
        const layout = loadLayout('indexes-cross-file');
        const db = new Parser().parse(layout, 'dbmlv2');

        const allTables = db.schemas.flatMap((s) => s.tables);
        const tableNames = allTables.map((t) => t.name);
        expect(tableNames).toContain('events');
        expect(tableNames).toContain('bookings');

        const bookings = allTables.find((t) => t.name === 'bookings')!;
        // Composite unique index should survive the cross-file import
        expect(bookings.indexes.length).toBeGreaterThan(0);
        expect(bookings.indexes.find((i: any) => i.unique && i.columns.length === 2)).toBeDefined();
      },
    );
  });

  describe('error handling', () => {
    test('non-dbmlv2 format rejects layout', () => {
      const layout = loadLayout('enum-across-files');
      expect(() => new Parser().parse(layout as any, 'mysql')).toThrow();
    });

    test('cross-file-duplicate-ref: layout without main.dbml silently produces empty output instead of surfacing REF_REDEFINED errors', () => {
      // BUG: cross-file-duplicate-ref has base.dbml + consumer.dbml but no main.dbml.
      // Parser.parse uses DEFAULT_ENTRY (/main.dbml) which doesn't exist in the layout,
      // so @dbml/parse returns empty results with no errors rather than throwing.
      // This means the REF_REDEFINED errors in consumer.dbml are never surfaced.
      const layout = loadLayout('cross-file-duplicate-ref');
      // Should ideally throw because the layout's entry point is absent, but currently silently returns
      const db = new Parser().parse(layout, 'dbmlv2');
      expect(db.schemas.flatMap((s: any) => s.tables)).toHaveLength(0);
    });
  });
});
