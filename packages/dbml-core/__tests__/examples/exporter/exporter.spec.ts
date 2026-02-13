import exporter from '../../../src/export';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ExportFormatOption } from '../../../types/export/ModelExporter';
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect, describe } from 'vitest';

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
