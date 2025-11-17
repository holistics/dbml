import exporter from '../../../src/export';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ExportFormatOption } from '../../../types/export/ModelExporter';

describe('@dbml/core - exporter', () => {
  const runTest = async (fileName: string, testDir: string, format: ExportFormatOption) => {
    const fileExtension = getFileExtension(format);
    const input = await import(`./${testDir}/input/${fileName}.in.dbml`);
    const output = await import(`./${testDir}/output/${fileName}.out.${fileExtension}`);
    const res = exporter.export(input, format);

    expect(res).toBe(output);
  };

  test.each(scanTestNames(__dirname, 'mysql_exporter/input'))('mysql_exporter/%s', (name) => {
    runTest(name, 'mysql_exporter', 'mysql');
  });

  test.each(scanTestNames(__dirname, 'postgres_exporter/input'))('postgres_exporter/%s', (name) => {
    runTest(name, 'postgres_exporter', 'postgres');
  });

  test.each(scanTestNames(__dirname, 'mssql_exporter/input'))('mssql_exporter/%s', (name) => {
    runTest(name, 'mssql_exporter', 'mssql');
  });

  test.each(scanTestNames(__dirname, 'oracle_exporter/input'))('oracle_exporter/%s', (name) => {
    runTest(name, 'oracle_exporter', 'oracle');
  });
});
