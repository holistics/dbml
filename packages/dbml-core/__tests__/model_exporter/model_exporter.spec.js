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


describe('@dbml/core - model_exporter dbml_exporter.escapeNote', () => {
  /**
   * @param {string} inputStr       = input note
   * @param {string} expectedOutput = expected DBML serialized output
   */
  const runTest = (inputStr, expectedOutput) => {
    expect(DbmlExporter.escapeNote(inputStr)).toBe(expectedOutput);
  };

  runTest('hello', "'hello'");
  // Spec is not very clear about string single quote, but also escape \ with \\
  runTest('hell\\o', "'hell\\\\o'");

  // As soon as we have CRLF or single quotes, we switch to triple quotes
  runTest("hel'lo", "'''hel'lo'''");
  // Only tripe quotes need escaping
  // See https://dbml.dbdiagram.io/docs/#multi-line-string
  runTest("hel'''lo", "'''hel\\'''lo'''");
  runTest('hel\nlo', "'''hel\nlo'''");
  // CRLF => \n
  runTest('hel\r\nlo', "'''hel\nlo'''");
  runTest('hel\n\nlo', "'''hel\n\nlo'''");
  runTest("hel'\n\nlo", "'''hel'\n\nlo'''");
  runTest("hel'\n\n''lo", "'''hel'\n\n''lo'''");
  runTest("hel'\n\n''lo", "'''hel'\n\n''lo'''");
  // Spec is clear here, \ needs to be escaped as \\
  runTest('hell\\\no', "'''hell\\\\\no'''");
});
