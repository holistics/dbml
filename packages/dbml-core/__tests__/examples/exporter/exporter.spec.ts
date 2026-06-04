import exporter from '../../../src/export';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ExportFormat } from '../../../types/export/ModelExporter';
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

const DBML_WITH_EXAMPLE_RECORDS = `
Table users {
  id integer [pk]
  name varchar
}

Records users(id, name) [example] {
  1, 'Alice'
  2, 'Bob'
}
`.trim();

const DBML_WITH_MIXED_RECORDS = `
Table users {
  id integer [pk]
  name varchar
}

Table posts {
  id integer [pk]
  title varchar
}

Records users(id, name) [example] {
  1, 'Alice'
}

Records posts(id, title) {
  1, 'First Post'
}
`.trim();

describe('@dbml/core - records example flag', () => {
  test('exports example flag in DBML output', () => {
    const res = exporter.export(DBML_WITH_EXAMPLE_RECORDS, 'dbml');
    expect(res).toContain('[example]');
    expect(res).toContain('Alice');
  });

  test('excludes example records from SQL output', () => {
    for (const format of ['mysql', 'postgres', 'mssql', 'oracle'] as const) {
      const res = exporter.export(DBML_WITH_EXAMPLE_RECORDS, format);
      expect(res).not.toContain('INSERT');
      expect(res).not.toContain('Alice');
    }
  });

  test('exports only non-example records as SQL', () => {
    for (const format of ['mysql', 'postgres', 'mssql', 'oracle'] as const) {
      const res = exporter.export(DBML_WITH_MIXED_RECORDS, format);
      expect(res).toContain('First Post');
      expect(res).not.toContain('Alice');
    }
  });

  test('preserves example flag in DBML roundtrip with mixed records', () => {
    const res = exporter.export(DBML_WITH_MIXED_RECORDS, 'dbml');
    expect(res).toContain('[example]');
    expect(res).toContain('Alice');
    expect(res).toContain('First Post');
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
