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

describe('@dbml/core - optional ref operators', () => {
  const OPTIONAL_REF_OPS = [
    '-', '-?', '?-', '?-?',
    '>', '>?', '?>', '?>?',
    '<', '<?', '?<', '?<?',
    '<>', '<>?', '?<>', '?<>?',
  ];

  const EXPECTED_OP: Record<string, string> = {
    '-': '-', '-?': '-?', '?-': '?-', '?-?': '?-?',
    '>': '<', '>?': '?<', '?>': '<?', '?>?': '?<?',
    '<': '<', '<?': '<?', '?<': '?<', '?<?': '?<?',
    '<>': '<>', '<>?': '<>?', '?<>': '?<>', '?<>?': '?<>?',
  };

  describe('dbml exporter', () => {
    test.each(OPTIONAL_REF_OPS)('should export ref with operator %s', (op) => {
      const input = `
        Table users { id integer [pk] }
        Table posts { user_id integer }
        Ref: posts.user_id ${op} users.id
      `.trim();
      const res = exporter.export(input, 'dbml');
      expect(res).toContain(EXPECTED_OP[op]);
    });
  });

  describe('sql exporters', () => {
    const sqlFormats: ExportFormat[] = ['mysql', 'postgres', 'mssql'];

    test.each(sqlFormats)('%s exporter should handle optional ref without error', (format) => {
      const input = `
        Table users { id integer [pk] }
        Table posts { user_id integer }
        Ref: posts.user_id >? users.id
      `.trim();
      expect(() => exporter.export(input, format)).not.toThrow();
    });

    test.each(sqlFormats)('%s exporter should produce FK constraint for optional ref', (format) => {
      const input = `
        Table users { id integer [pk] }
        Table posts { user_id integer }
        Ref: posts.user_id >? users.id
      `.trim();
      const res = exporter.export(input, format);
      expect(res).toContain('FOREIGN KEY');
      expect(res).toContain('REFERENCES');
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
