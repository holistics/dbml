import { describe, test, expect } from 'vitest';
import Parser from '../../../src/parse/Parser';
import { MemoryProjectLayout, Filepath } from '@dbml/parse';
import { CompilerError } from '../../../src/parse/error';
import type { CompilerDiagnostic } from '../../../src/parse/error';
import type { Index } from '../../../types';

// Builds an in-memory project layout from a filepath -> source map. The file
// at `entry` is mounted as `/main.dbml` so `Parser.parse(layout, 'dbmlv2')`
// (which always reads from DEFAULT_ENTRY) starts from it. Every other file
// keeps its natural relative path so `use { ... } from './...'` imports
// resolve as written.
function makeLayout (files: Record<string, string>, entry: string): MemoryProjectLayout {
  const layout = new MemoryProjectLayout();
  for (const [relPath, source] of Object.entries(files)) {
    const targetPath = relPath === entry ? '/main.dbml' : relPath;
    layout.setSource(Filepath.from(targetPath), source);
  }
  return layout;
}

const ENUM_SOURCE_DBML = `
Enum job_status {
  pending
  running
  done
}
`;

describe('@dbml/core multifile', () => {
  describe('basic cross-file enum import', () => {
    test('direct import: field type resolves to enum defined in another file', () => {
      const layout = makeLayout({
        '/enum-source.dbml': ENUM_SOURCE_DBML,
        '/consumer-direct-import.dbml': `
use { enum job_status } from './enum-source.dbml'

Table jobs {
  id int [pk]
  status job_status
}
`,
      }, '/consumer-direct-import.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const jobs = allTables.find((t) => t.name === 'jobs');
      expect(jobs).toBeDefined();

      const statusField = jobs!.fields.find((f) => f.name === 'status');
      expect(statusField).toBeDefined();
      expect(statusField!.type.type_name).toBe('job_status');
    });

    test('aliased import: field type resolves via the alias, not the original name', () => {
      const layout = makeLayout({
        '/enum-source.dbml': ENUM_SOURCE_DBML,
        '/consumer-aliased-import.dbml': `
use { enum job_status as Status } from './enum-source.dbml'

Table jobs {
  id int [pk]
  status Status
}
`,
      }, '/consumer-aliased-import.dbml');
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
      const layout = makeLayout({
        '/schema-qualified-tables.dbml': `
Table auth.users {
  id int [pk]
  email varchar
}

Table auth.roles {
  id int [pk]
  name varchar
}
`,
        '/consumer-schema-qualified-wildcard.dbml': `
use * from './schema-qualified-tables.dbml'

Table orders {
  id int [pk]
  user_id int
}
`,
      }, '/consumer-schema-qualified-wildcard.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      expect(allTables.map((t) => t.name)).toContain('orders');
    });

    test('reuse chain: tables imported via reuse chain are visible', () => {
      const layout = makeLayout({
        '/reuse-chain-base.dbml': `
Enum order_status {
  pending
  shipped
  delivered
}

Table users {
  id int [pk]
  name varchar
}

Table orders {
  id int [pk]
  user_id int
  status order_status
}

Ref: orders.user_id > users.id
`,
        '/reuse-chain-middle.dbml': `reuse * from './reuse-chain-base.dbml'`,
        '/consumer-reuse-chain.dbml': `
use * from './reuse-chain-middle.dbml'

Table payments {
  id int [pk]
  order_id int
}
`,
      }, '/consumer-reuse-chain.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const tableNames = allTables.map((t) => t.name);

      expect(tableNames).toContain('payments');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('orders');
    });
  });

  describe('mixed imports from same source file', () => {
    test('selective + wildcard from same file is idempotent (no DUPLICATE_NAME)', () => {
      // `use { table users }` followed by `use * from` the same source produces
      // two distinct UseSymbol wrappers around the same underlying table; they
      // collapse to a single member via (originalSymbol, name) dedupe, so all
      // three tables surface in the @dbml/core model.
      const layout = makeLayout({
        '/single-source-tables.dbml': `
Table users {
  id int [pk]
  name varchar
}

Table roles {
  id int [pk]
  label varchar
}

Enum user_role {
  admin
  member
}
`,
        '/consumer-selective-and-wildcard.dbml': `
use { table users } from './single-source-tables.dbml'
use * from './single-source-tables.dbml'

Table memberships {
  id int [pk]
  user_id int
  role_id int
  kind user_role
}

Ref: memberships.user_id > users.id
Ref: memberships.role_id > roles.id
`,
      }, '/consumer-selective-and-wildcard.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const tableNames = allTables.map((t) => t.name);
      expect(tableNames).toContain('memberships');
      expect(tableNames).toContain('users');
      expect(tableNames).toContain('roles');
    });
  });

  describe('cross-file refs and indexes', () => {
    test('cross-file index: imported table with composite indexes accessible in @dbml/core model', () => {
      // @dbml/parse exposes the imported `bookings` table via exportSchemaJson's
      // reconciled output, so @dbml/core sees it alongside the locally-defined
      // `events` table - refs and composite indexes survive the import.
      const layout = makeLayout({
        '/composite-index-source.dbml': `
Table bookings {
  id int [pk]
  user_id int
  event_id int
  created_at timestamp

  indexes {
    (user_id, event_id) [unique, name: 'unique_booking']
    created_at
  }
}
`,
        '/consumer-cross-file-index.dbml': `
use { table bookings } from './composite-index-source.dbml'

Table events {
  id int [pk]
  name varchar
}

Ref: bookings.event_id > events.id
`,
      }, '/consumer-cross-file-index.dbml');
      const db = new Parser().parse(layout, 'dbmlv2');

      const allTables = db.schemas.flatMap((s) => s.tables);
      const tableNames = allTables.map((t) => t.name);
      expect(tableNames).toContain('events');
      expect(tableNames).toContain('bookings');

      const bookings = allTables.find((t) => t.name === 'bookings')!;
      // Composite unique index should survive the cross-file import
      expect(bookings.indexes.length).toBeGreaterThan(0);
      expect(bookings.indexes.find((i: Index) => i.unique && i.columns.length === 2)).toBeDefined();
    });
  });

  describe('error handling', () => {
    test('non-dbmlv2 format rejects layout', () => {
      const layout = makeLayout({
        '/enum-source.dbml': 'Enum job_status { pending running done }',
        '/consumer.dbml': `use { enum job_status } from './enum-source.dbml'
Table jobs { id int [pk] status job_status }`,
      }, '/consumer.dbml');
      // Cast to string so the call type-checks; runtime should still throw because
      // non-dbmlv2 backends only accept raw source strings, not a project layout.
      expect(() => new Parser().parse(layout as unknown as string, 'mysql')).toThrow();
    });

    test('duplicate cross-file ref: REF_REDEFINED is surfaced when the consumer is the entrypoint', () => {
      // The consumer does `use *` from a base file that already declares
      // `Ref: orders.user_id > users.id` and then declares the same ref
      // again. The parser must throw with REF_REDEFINED (code 5001) rather
      // than swallow the duplicate.
      const layout = makeLayout({
        '/duplicate-ref-base.dbml': `
Table users {
  id int [pk]
  name varchar
}

Table orders {
  id int [pk]
  user_id int
}

Ref: orders.user_id > users.id
`,
        '/consumer-duplicate-ref.dbml': `
use * from './duplicate-ref-base.dbml'

// Declaring the same ref endpoints again should produce an error
Ref: orders.user_id > users.id
`,
      }, '/consumer-duplicate-ref.dbml');
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
