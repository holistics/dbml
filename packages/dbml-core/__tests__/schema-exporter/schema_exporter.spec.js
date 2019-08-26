import Parser from '../../src/parse/Parser';
import DbmlExporter from '../../src/export/DbmlExporter';
import JsonExporter from '../../src/export/JsonExporter';
import MysqlExporter from '../../src/export/MysqlExporter';
import PostgresExporter from '../../src/export/PostgresExporter';

describe('@dbml/core', () => {
  describe('schema-exporter', () => {
    /**
     * @param {string} format = [json|mysql|dbml|postgres]
     */
    const runTest = (fileName, testDir, format, ExporterClass) => {
      const parser = new Parser();
      /* eslint-disable */
      const fileExtension = getFileExtension(format);
      const input = require(`./${testDir}/input/${fileName}.in.json`);
      const output = require(`./${testDir}/output/${fileName}.out.${fileExtension}`);
      /* eslint-enable */
      const schema = parser.parse(input, 'json');
      const exporter = new ExporterClass(schema);
      const res = exporter.export();

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
    test.each(scanTestNames(__dirname, 'json-exporter/input'))('json-exporter/%s', (name) => {
      runTest(name, 'json-exporter', 'json', JsonExporter);
    });

    test.each(scanTestNames(__dirname, 'dbml-exporter/input'))('dbml-exporter/%s', (name) => {
      runTest(name, 'dbml-exporter', 'dbml', DbmlExporter);
    });

    test.each(scanTestNames(__dirname, 'mysql-exporter/input'))('mysql-exporter/%s', (name) => {
      runTest(name, 'mysql-exporter', 'mysql', MysqlExporter);
    });

    test.each(scanTestNames(__dirname, 'postgres-exporter/input'))('postgres-exporter/%s', (name) => {
      runTest(name, 'postgres-exporter', 'postgres', PostgresExporter);
    });
    /* eslint-enable */
  });
});
