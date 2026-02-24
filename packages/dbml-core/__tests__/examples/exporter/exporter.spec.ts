import exporter from '../../../src/export';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ExportFormatOption } from '../../../types/export/ModelExporter';
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
  const runTest = async (fileName: string, testDir: string, format: ExportFormatOption) => {
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
