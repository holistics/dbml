import Parser from '../../src/parse/Parser';
import DbmlExporter from '../../src/export/DbmlExporter';
import JsonExporter from '../../src/export/JsonExporter';
import MysqlExporter from '../../src/export/MysqlExporter';
import PostgresExporter from '../../src/export/PostgresExporter';
import SqlServerExporter from '../../src/export/SqlServerExporter';

describe('@dbml/core - model_exporter', () => {
  /**
   * @param {string} format = [json|mysql|dbml|postgres]
   */
  const runTest = (fileName, testDir, format, ExporterClass) => {
    /* eslint-disable */
    const fileExtension = getFileExtension(format);
    const input = require(`./${testDir}/input/${fileName}.in.json`);
    const output = require(`./${testDir}/output/${fileName}.out.${fileExtension}`);
    /* eslint-enable */
    const database = (new Parser()).parse(input, 'json');
    let res;
    if (format === 'json') {
      res = ExporterClass.export(database, false);
    } else {
      res = ExporterClass.export(database.normalize());
    }

    switch (format) {
      case 'json':
        // eslint-disable-next-line
        isEqualExcludeTokenEmpty(JSON.parse(res), output);
        break;

      default:
        expect(res).toBe(output);
        break;
    }
  };

  /* eslint-disable */
  test.each(scanTestNames(__dirname, 'json_exporter/input'))('json_exporter/%s', (name) => {
    runTest(name, 'json_exporter', 'json', JsonExporter);
  });

  test.each(scanTestNames(__dirname, 'dbml_exporter/input'))('dbml_exporter/%s', (name) => {
    runTest(name, 'dbml_exporter', 'dbml', DbmlExporter);
  });

  test.each(scanTestNames(__dirname, 'mysql_exporter/input'))('mysql_exporter/%s', (name) => {
    runTest(name, 'mysql_exporter', 'mysql', MysqlExporter);
  });

  test.each(scanTestNames(__dirname, 'postgres_exporter/input'))('postgres_exporter/%s', (name) => {
    runTest(name, 'postgres_exporter', 'postgres', PostgresExporter);
  });

  test.each(scanTestNames(__dirname, 'mssql_exporter/input'))('mssql_exporter/%s', (name) => {
    runTest(name, 'mssql_exporter', 'mssql', SqlServerExporter);
  });
  /* eslint-enable */
});
