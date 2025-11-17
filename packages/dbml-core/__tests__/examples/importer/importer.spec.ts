import importer from '../../../src/import';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ParseFormat } from '../../../types/parse/Parser';

describe('@dbml/core - importer', () => {
  const runTest = async (fileName: string, testDir: string, format: ParseFormat) => {
    const fileExtension = getFileExtension(format);
    const input = await import(`./${testDir}/input/${fileName}.in.${fileExtension}`);
    const output = await import(`./${testDir}/output/${fileName}.out.dbml`);

    const res = importer.import(input, format);

    expect(res).toBe(output);
  };

  test.each(scanTestNames(__dirname, 'json_importer/input'))('json_importer/%s', (name) => {
    runTest(name, 'json_importer', 'json');
  });

  test.each(scanTestNames(__dirname, 'mysql_importer/input'))('mysql_importer/%s', (name) => {
    runTest(name, 'mysql_importer', 'mysql');
  });

  test.each(scanTestNames(__dirname, 'postgres_importer/input'))('postgres_importer/%s', (name) => {
    runTest(name, 'postgres_importer', 'postgres');
  });

  test.each(scanTestNames(__dirname, 'mssql_importer/input'))('mssql_importer/%s', (name) => {
    runTest(name, 'mssql_importer', 'mssql');
  });

  test.each(scanTestNames(__dirname, 'snowflake_importer/input'))('snowflake_importer/%s', (name) => {
    runTest(name, 'snowflake_importer', 'snowflake');
  });

  test.each(scanTestNames(__dirname, 'oracle_importer/input'))('oracle_importer/%s', (name) => {
    runTest(name, 'oracle_importer', 'oracle');
  });
});
