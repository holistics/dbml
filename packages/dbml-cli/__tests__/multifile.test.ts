import childProcess from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import util from 'util';
import stripAnsi from 'strip-ansi';

const exec = util.promisify(childProcess.exec);
const DBML2SQL_BIN = path.join(__dirname, '../bin/dbml2sql.js');

interface MultifileCase {
  name: string;
  files: Record<string, string>;
  entry: string;
  expectedStdout: string;
}

const CASES: MultifileCase[] = [
  {
    name: 'alias-and-schema-strip',
    files: {
      'auth-tables.dbml': `\
// source: schema-qualified table
Table auth.users {
  id int [pk]
  email varchar
}
`,
      'main.dbml': `\
// alias strips schemaName; inline ref binds against the alias 'u'
use { table auth.users as u } from './auth-tables.dbml'

Table orders {
  id int [pk]
  user_id int [ref: > u.id]
}
`,
    },
    entry: 'main.dbml',
    expectedStdout: `\
CREATE TABLE "orders" (
  "id" int PRIMARY KEY,
  "user_id" int
);

CREATE TABLE "u" (
  "id" int PRIMARY KEY,
  "email" varchar
);

ALTER TABLE "orders" ADD FOREIGN KEY ("user_id") REFERENCES "u" ("id") DEFERRABLE INITIALLY IMMEDIATE;

`,
  },
  {
    name: 'enum-across-files',
    files: {
      'types.dbml': `\
// source enum
Enum job_status {
  pending
  running
  done
}
`,
      'main.dbml': `\
// import enum and use it as a field type
use { enum job_status } from './types.dbml'

Table jobs {
  id int [pk]
  status job_status
}
`,
    },
    entry: 'main.dbml',
    expectedStdout: `\
CREATE TYPE "job_status" AS ENUM (
  'pending',
  'running',
  'done'
);

CREATE TABLE "jobs" (
  "id" int PRIMARY KEY,
  "status" job_status
);

`,
  },
  {
    name: 'enum-alias',
    files: {
      'types.dbml': `\
Enum job_status {
  pending
  running
  done
}
`,
      'main.dbml': `\
// import enum under an alias; the alias should be the resolvable name
use { enum job_status as Status } from './types.dbml'

Table jobs {
  id int [pk]
  status Status
}
`,
    },
    entry: 'main.dbml',
    expectedStdout: `\
CREATE TYPE "Status" AS ENUM (
  'pending',
  'running',
  'done'
);

CREATE TABLE "jobs" (
  "id" int PRIMARY KEY,
  "status" "Status"
);

`,
  },
  {
    name: 'indexes-cross-file',
    files: {
      'tables.dbml': `\
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
      'main.dbml': `\
// import a table that has composite indexes defined
// verifies indexes are preserved when a table is pulled across files
use { table bookings } from './tables.dbml'

Table events {
  id int [pk]
  name varchar
}

Ref: bookings.event_id > events.id
`,
    },
    entry: 'main.dbml',
    expectedStdout: `\
CREATE TABLE "events" (
  "id" int PRIMARY KEY,
  "name" varchar
);

CREATE TABLE "bookings" (
  "id" int PRIMARY KEY,
  "user_id" int,
  "event_id" int,
  "created_at" timestamp
);

CREATE UNIQUE INDEX "unique_booking" ON "bookings" ("user_id", "event_id");

CREATE INDEX ON "bookings" ("created_at");

ALTER TABLE "bookings" ADD FOREIGN KEY ("event_id") REFERENCES "events" ("id") DEFERRABLE INITIALLY IMMEDIATE;

`,
  },
  {
    name: 'wildcard-reuse-chain',
    files: {
      'a.dbml': `\
// base: defines tables and an enum
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
      'b.dbml': `\
// middle: reuses everything from a — re-exports all symbols transitively
reuse * from './a.dbml'
`,
      'main.dbml': `\
// consumer: imports from b (which re-exports everything from a via reuse *)
// verifies wildcard reuse propagates tables, enums transitively
use * from './b.dbml'

Table payments {
  id int [pk]
  order_id int
}
`,
    },
    entry: 'main.dbml',
    expectedStdout: `\
CREATE TABLE "payments" (
  "id" int PRIMARY KEY,
  "order_id" int
);

`,
  },
];

describe('@dbml/cli multifile', () => {
  test.each(CASES)('dbml2sql multifile/$name', async ({ files, entry, expectedStdout }) => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dbml-cli-multifile-'));
    try {
      for (const [filename, content] of Object.entries(files)) {
        fs.writeFileSync(path.join(tmpDir, filename), content, 'utf-8');
      }
      const entryPath = path.join(tmpDir, entry);
      const { stdout } = await exec(`node ${DBML2SQL_BIN} ${entryPath}`);
      expect(stripAnsi(stdout)).toBe(expectedStdout);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }, 100000);
});
