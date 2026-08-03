import exporter from '../../../src/export';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ExportFormat } from '../../../types/export';
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect, describe } from 'vitest';

const DBML_WITH_RECORDS = `
Table users {
  id integer [pk]
  name varchar
}

Records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}
`.trim();

describe('@dbml/core - exporter', () => {
  const runTest = async (fileName: string, testDir: string, format: ExportFormat) => {
    const fileExtension = getFileExtension(format);
    const input = readFileSync(path.resolve(__dirname, `./${testDir}/input/${fileName}.in.dbml`), { encoding: 'utf8' });
    const output = readFileSync(path.resolve(__dirname, `./${testDir}/output/${fileName}.out.${fileExtension}`), { encoding: 'utf8' });
    const res = exporter.export(input, format);

    // Exclude meaningless spaces from failing the tests
    expect(res.trim()).toBe(output.trim());
  };

  const spec = {
    mysql_exporter: 'mysql',
    postgres_exporter: 'postgres',
    mssql_exporter: 'mssql',
    oracle_exporter: 'oracle',
  } as const;

  for (const [exporter, type] of Object.entries(spec)) {
    test.each(scanTestNames(__dirname, `${exporter}/input`))(`${exporter}/%s`, async (name) => {
      await runTest(name, exporter, type);
    });
  }
});

const EXPECTED_DBML_WITH_RECORDS =
`Table "users" {
  "id" integer [pk]
  "name" varchar
}

Records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}`;

const EXPECTED_DBML_WITHOUT_RECORDS =
`Table "users" {
  "id" integer [pk]
  "name" varchar
}`;

const DBML_WITH_INACTIVE_REF = `
Table users {
  id integer [pk]
}
Table posts {
  user_id integer
}
Ref: posts.user_id > users.id [inactive]
`.trim();

const DBML_WITHOUT_INACTIVE_REF = `
Table users {
  id integer [pk]
}
Table posts {
  user_id integer
}
Ref: posts.user_id > users.id
`.trim();

describe('@dbml/core - ref inactive setting', () => {
  test('exports inactive ref with inactive flag', () => {
    const res = exporter.export(DBML_WITH_INACTIVE_REF, 'dbml');
    expect(res).toContain('[inactive]');
  });

  test('does not export inactive flag when setting absent', () => {
    const res = exporter.export(DBML_WITHOUT_INACTIVE_REF, 'dbml');
    expect(res).not.toContain('inactive');
  });
});

describe('@dbml/core - optional ref operators', () => {
  describe('dbml exporter', () => {
    test('should export ref with operator -?', () => {
      const input = `
Table users { id integer [pk] }
Table posts { user_id integer [unique] }
Ref: posts.user_id -? users.id
      `.trim();
      const res = exporter.export(input, 'dbml');
      expect(res.trim()).toBe(
`Table "users" {
  "id" integer [pk]
}

Table "posts" {
  "user_id" integer [unique]
}

Ref:"posts"."user_id" -? "users"."id"`);
    });

    test('should export ref with operator >? (no cardinality override for DBML sources)', () => {
      const input = `
Table users { id integer [pk] }
Table posts { user_id integer [not null] }
Ref: posts.user_id >? users.id
      `.trim();
      const res = exporter.export(input, 'dbml');
      expect(res.trim()).toBe(
`Table "users" {
  "id" integer [pk]
}

Table "posts" {
  "user_id" integer [not null]
}

Ref:"users"."id" ?< "posts"."user_id"`);
    });

    test('should export ref with operator ?<?', () => {
      const input = `
Table users { id integer [pk] }
Table posts { user_id integer }
Ref: posts.user_id ?<? users.id
      `.trim();
      const res = exporter.export(input, 'dbml');
      expect(res.trim()).toBe(
`Table "users" {
  "id" integer [pk]
}

Table "posts" {
  "user_id" integer
}

Ref:"posts"."user_id" ?<? "users"."id"`);
    });
  });

  describe('table partial refs', () => {
    test('should preserve optional ref from table partial (nullable FK)', () => {
      const input = `
TablePartial auditable {
  created_by int [ref: >? users.id]
}
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  ~auditable
}
      `.trim();
      const res = exporter.export(input, 'dbml');
      // >? should export as ?< (flipped direction, optional on the one side)
      expect(res.trim()).toContain('?<');
      // Should NOT become many-to-many (<>)
      expect(res.trim()).not.toContain('<>');
    });

    test('should preserve required ref from table partial', () => {
      const input = `
TablePartial auditable {
  created_by int [ref: > users.id]
}
Table users {
  id int [pk]
}
Table posts {
  id int [pk]
  ~auditable
}
      `.trim();
      const res = exporter.export(input, 'dbml');
      // > should export as < (flipped direction, required many-to-one)
      expect(res.trim()).toMatch(/"users"\."id" < "posts"\."created_by"/);
    });
  });

  describe('sql exporters', () => {
    test('mysql exporter should produce FK constraint for optional ref', () => {
      const input = `
Table users { id integer [pk] }
Table posts { user_id integer [not null] }
Ref: posts.user_id >? users.id
      `.trim();
      const res = exporter.export(input, 'mysql');
      expect(res.trim()).toBe(
`CREATE TABLE \`users\` (
  \`id\` integer PRIMARY KEY
);

CREATE TABLE \`posts\` (
  \`user_id\` integer NOT NULL
);

ALTER TABLE \`posts\` ADD FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`);`);
    });

    test('postgres exporter should produce FK constraint for optional ref', () => {
      const input = `
Table users { id integer [pk] }
Table posts { user_id integer [not null] }
Ref: posts.user_id >? users.id
      `.trim();
      const res = exporter.export(input, 'postgres');
      expect(res.trim()).toBe(
`CREATE TABLE "users" (
  "id" integer PRIMARY KEY
);

CREATE TABLE "posts" (
  "user_id" integer NOT NULL
);

ALTER TABLE "posts" ADD FOREIGN KEY ("user_id") REFERENCES "users" ("id") DEFERRABLE INITIALLY IMMEDIATE;`);
    });

    test('mssql exporter should produce FK constraint for optional ref', () => {
      const input = `
Table users { id integer [pk] }
Table posts { user_id integer [not null] }
Ref: posts.user_id >? users.id
      `.trim();
      const res = exporter.export(input, 'mssql');
      expect(res.trim()).toBe(
`CREATE TABLE [users] (
  [id] integer PRIMARY KEY
)
GO

CREATE TABLE [posts] (
  [user_id] integer NOT NULL
)
GO

ALTER TABLE [posts] ADD FOREIGN KEY ([user_id]) REFERENCES [users] ([id])
GO`);
    });
  });
});

describe('@dbml/core - exporter flags', () => {
  describe('includeRecords', () => {
    test('includes records by default', () => {
      const res = exporter.export(DBML_WITH_RECORDS, 'dbml');
      expect(res.trim()).toBe(EXPECTED_DBML_WITH_RECORDS);
    });

    test('includes records when includeRecords is true', () => {
      const res = exporter.export(DBML_WITH_RECORDS, 'dbml', { includeRecords: true });
      expect(res.trim()).toBe(EXPECTED_DBML_WITH_RECORDS);
    });

    test('omits records when includeRecords is false', () => {
      const res = exporter.export(DBML_WITH_RECORDS, 'dbml', { includeRecords: false });
      expect(res.trim()).toBe(EXPECTED_DBML_WITHOUT_RECORDS);
    });
  });
});
