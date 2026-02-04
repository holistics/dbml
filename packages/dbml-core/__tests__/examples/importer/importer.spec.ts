import importer from '../../../src/import';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ParseFormat } from '../../../types/parse/Parser';
import { readFileSync } from 'fs';
import path from 'path';

describe('@dbml/core - importer', () => {
  const runTest = async (fileName: string, testDir: string, format: ParseFormat) => {
    const fileExtension = getFileExtension(format);
    const input = readFileSync(path.resolve(__dirname, `./${testDir}/input/${fileName}.in.${fileExtension}`), { encoding: 'utf8' });
    const output = readFileSync(path.resolve(__dirname, `./${testDir}/output/${fileName}.out.dbml`), { encoding: 'utf8' });

    const res = importer.import(input, format);

    expect(res).toBe(output);
  };

  test.each(scanTestNames(__dirname, 'json_importer/input'))('json_importer/%s', async (name) => {
    await runTest(name, 'json_importer', 'json');
  });

  test.each(scanTestNames(__dirname, 'mysql_importer/input'))('mysql_importer/%s', async (name) => {
    await runTest(name, 'mysql_importer', 'mysql');
  });

  test.each(scanTestNames(__dirname, 'postgres_importer/input'))('postgres_importer/%s', async (name) => {
    await runTest(name, 'postgres_importer', 'postgres');
  });

  test.each(scanTestNames(__dirname, 'mssql_importer/input'))('mssql_importer/%s', async (name) => {
    await runTest(name, 'mssql_importer', 'mssql');
  });

  test.each(scanTestNames(__dirname, 'snowflake_importer/input'))('snowflake_importer/%s', async (name) => {
    await runTest(name, 'snowflake_importer', 'snowflake');
  });

  test.each(scanTestNames(__dirname, 'oracle_importer/input'))('oracle_importer/%s', async (name) => {
    await runTest(name, 'oracle_importer', 'oracle');
  });
});
