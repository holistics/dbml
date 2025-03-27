/* eslint-disable */
import Parser from '../../src/parse/Parser';

describe('@dbml/core', () => {
  describe('parser', () => {
    /**
     * @param {string} format = [json|mysql|postgres|dbml|schemarb|mssql|mssqlv2]
     */
    const runTest = (fileName, testDir, format, parseFuncName) => {
      const fileExtension = getFileExtension(format);

      const input = require(`./${testDir}/input/${fileName}.in.${fileExtension}`);
      const output = require(`./${testDir}/output/${fileName}.out.json`);
      const jsonSchema = Parser[parseFuncName](input);
      isEqualExcludeTokenEmpty(jsonSchema, output);
    };

    test.each(scanTestNames(__dirname, 'mysql-parse/input'))('mysql-parse/%s', (name) => {
      runTest(name, 'mysql-parse', 'mysql', 'parseMySQLToJSONv2');
    });

    test.each(scanTestNames(__dirname, 'postgres-parse/input'))('postgres-parse/%s', (name) => {
      runTest(name, 'postgres-parse', 'postgres', 'parsePostgresToJSONv2');
    });

    test.each(scanTestNames(__dirname, 'schemarb-parse/input'))('schemarb-parse/%s', (name) => {
      runTest(name, 'schemarb-parse', 'schemarb', 'parseSchemaRbToJSON');
    });

    test.each(scanTestNames(__dirname, 'mssql-parse/input'))('mssql-parse/%s', (name) => {
      runTest(name, 'mssql-parse', 'mssql', 'parseMSSQLToJSON');
    });

    test.each(scanTestNames(__dirname, 'mssqlv2-parse/input'))('mssqlv2-parse/%s', (name) => {
      runTest(name, 'mssqlv2-parse', 'mssql', 'parseMSSQLToJSONv2');
    });
  });
});
