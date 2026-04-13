import { readFileSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { describe, test, expect } from 'vitest';
import Parser from '../../../src/parse/Parser';
import { MemoryProjectLayout, Filepath } from '@dbml/parse';
import { CompilerError } from '../../../src/parse/error';
import type { CompilerDiagnostic } from '../../../src/parse/error';
import type { Index } from '../../../types';

const SAMPLES_DIR = path.resolve(__dirname, '../../../../dbml-parse/__tests__/samples');

// Loads every .dbml file in `projectName` into a layout. The chosen `entryFile`
// is mounted as `/main.dbml` so `Parser.parse(layout, 'dbmlv2')` (which always
// reads from DEFAULT_ENTRY) starts from that file. Other files keep their
// natural relative path so cross-file `from './...'` imports still resolve.
function loadLayout (projectName: string, entryFile?: string): MemoryProjectLayout {
  const dir = path.join(SAMPLES_DIR, projectName);
  const layout = new MemoryProjectLayout();

  function walk (d: string) {
    for (const entry of readdirSync(d)) {
      const full = path.join(d, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else if (full.endsWith('.dbml')) {
        const rel = full.slice(dir.length); // e.g. /consumer-direct-import.dbml
        const source = readFileSync(full, 'utf-8');
        const isEntry = entryFile !== undefined && rel === `/${entryFile}`;
        layout.setSource(Filepath.from(isEntry ? '/main.dbml' : rel), source);
      }
    }
  }

  walk(dir);
  return layout;
}

describe('@dbml/core multifile', () => {
  describe('basic cross-file enum import', () => {
    test('direct import: field type resolves to enum defined in another file', () => {
      const layout = loadLayout('enum-imports', 'consumer-direct-import.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const jobs = allTables.find((t) => t.name === 'jobs');
      expect(jobs).toBeDefined();

      const statusField = jobs!.fields.find((f) => f.name === 'status');
      expect(statusField).toBeDefined();
      expect(statusField!.type.type_name).toBe('job_status');
    });

    test('aliased import: field type resolves via the alias, not the original name', () => {
      const layout = loadLayout('enum-imports', 'consumer-aliased-import.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const jobs = allTables.find((t) => t.name === 'jobs');
      expect(jobs).toBeDefined();

      const statusField = jobs!.fields.find((f) => f.name === 'status');
      expect(statusField).toBeDefined();
      expect(statusField!.type.type_name).toBe('Status');
    });
  });

  describe('wildcard imports', () => {
    test('schema-qualified wildcard: locally-defined table accessible after wildcard import', () => {
      const layout = loadLayout('wildcard-imports', 'consumer-schema-qualified-wildcard.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      expect(allTables.map((t) => t.name)).toContain('orders');
    });

    test('reuse chain: only entry-file-defined tables appear; tables imported via reuse chain are absent', () => {
      // BUG: tables imported via reuse * chain (base → middle → entry via use *)
      // are NOT visible in @dbml/core output, even though @dbml/parse resolves
      // them correctly. users, orders from reuse-chain-base.dbml should be
      // visible but are absent.
      const layout = loadLayout('wildcard-imports', 'consumer-reuse-chain.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const tableNames = allTables.map((t) => t.name);

      // 'payments' is locally defined in the consumer — always visible
      expect(tableNames).toContain('payments');

      // 'users' and 'orders' are from the reuse chain — currently NOT visible through @dbml/core
      expect(tableNames).not.toContain('users');
      expect(tableNames).not.toContain('orders');
    });
  });

  describe('mixed imports from same source file', () => {
    test.fails(
      'selective + wildcard from same file: should be idempotent, not a DUPLICATE_NAME error',
      () => {
        // BUG in @dbml/parse: `use { table users }` followed by `use * from same file`
        // produces DUPLICATE_NAME for 'users' even though it's the same symbol from the same source.
        // Expected: parse succeeds; actual: Parser throws CompilerError with DUPLICATE_NAME.
        const layout = loadLayout('wildcard-imports', 'consumer-selective-and-wildcard.dbml');
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
      'cross-file index: imported table with composite indexes accessible in @dbml/core model',
      () => {
        // BUG in @dbml/core: @dbml/parse correctly exports both 'bookings' (imported) and
        // 'events' (local) along with the ref. But @dbml/core model_structure/endpoint.js
        // throws "Can't find table null.bookings" because it only resolves locally-defined tables.
        // Expected: both tables visible with indexes and ref intact.
        const layout = loadLayout('cross-file-refs', 'consumer-cross-file-index.dbml');
        const db = new Parser().parse(layout, 'dbmlv2');

        const allTables = db.schemas.flatMap((s) => s.tables);
        const tableNames = allTables.map((t) => t.name);
        expect(tableNames).toContain('events');
        expect(tableNames).toContain('bookings');

        const bookings = allTables.find((t) => t.name === 'bookings')!;
        // Composite unique index should survive the cross-file import
        expect(bookings.indexes.length).toBeGreaterThan(0);
        expect(bookings.indexes.find((i: Index) => i.unique && i.columns.length === 2)).toBeDefined();
      },
    );
  });

  describe('error handling', () => {
    test('non-dbmlv2 format rejects layout', () => {
      const layout = loadLayout('enum-imports', 'consumer-direct-import.dbml');
      // Cast to string so the call type-checks; runtime should still throw because
      // non-dbmlv2 backends only accept raw source strings, not a project layout.
      expect(() => new Parser().parse(layout as unknown as string, 'mysql')).toThrow();
    });

    test('duplicate cross-file ref: REF_REDEFINED is surfaced when the consumer is the entrypoint', () => {
      // consumer-duplicate-ref.dbml does `use *` from duplicate-ref-base.dbml
      // (which already declares `Ref: orders.user_id > users.id`) and then
      // declares the same ref again. The parser must throw with REF_REDEFINED
      // (code 5001) rather than swallow the duplicate.
      const layout = loadLayout('cross-file-refs', 'consumer-duplicate-ref.dbml');
      let thrown: unknown;
      try {
        new Parser().parse(layout, 'dbmlv2');
      } catch (e) {
        thrown = e;
      }
      expect(thrown).toBeInstanceOf(CompilerError);
      const diags = (thrown as CompilerError).diags;
      expect(diags.some((d: CompilerDiagnostic) => d.code === 5001)).toBe(true);
    });
  });
});
