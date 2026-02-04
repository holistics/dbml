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

    expect(res).toBe(output);
  };

  test.each(scanTestNames(__dirname, 'mysql_exporter/input'))('mysql_exporter/%s', async (name) => {
    await runTest(name, 'mysql_exporter', 'mysql');
  });

  test.each(scanTestNames(__dirname, 'postgres_exporter/input'))('postgres_exporter/%s', async (name) => {
    await runTest(name, 'postgres_exporter', 'postgres');
  });

  test.each(scanTestNames(__dirname, 'mssql_exporter/input'))('mssql_exporter/%s', async (name) => {
    await runTest(name, 'mssql_exporter', 'mssql');
  });

  test.each(scanTestNames(__dirname, 'oracle_exporter/input'))('oracle_exporter/%s', async (name) => {
    await runTest(name, 'oracle_exporter', 'oracle');
  });
});
