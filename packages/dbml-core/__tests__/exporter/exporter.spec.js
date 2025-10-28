import exporter from '../../src/export';

describe('@dbml/core - exporter', () => {
  /**
   * @param {string} format = [json|mysql|postgres]
   */
  const runTest = (fileName, testDir, format) => {
    /* eslint-disable */
    const fileExtension = getFileExtension(format);
    const input = require(`./${testDir}/input/${fileName}.in.dbml`);
    const output = require(`./${testDir}/output/${fileName}.out.${fileExtension}`);
    const res = exporter.export(input, format);

    expect(res).toBe(output);
    /* eslint-enable */
  };

  /* eslint-disable */
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

  test.each(scanTestNames(__dirname, 'sqlite_exporter/input'))('sqlite_exporter/%s', (name) => {
    runTest(name, 'sqlite_exporter', 'sqlite');
  });

  /* eslint-enable */
});
