import Parser from '../../src/parse/Parser';
import { CompilerError } from '../../src/parse/error';

describe('@dbml/core', () => {
  describe('parser', () => {
    /**
     * @param {string} format = [json|mysql|postgres|dbml|schemarb]
     */
    const runTest = (fileName, testDir, format, parseFuncName) => {
      /* eslint-disable */
      const fileExtension = getFileExtension(format);
      const input = require(`./${testDir}/input/${fileName}.in.${fileExtension}`);
      const output = require(`./${testDir}/output/${fileName}.out.json`);
      try {
        const jsonSchema = Parser[parseFuncName](input);
        isEqualExcludeTokenEmpty(jsonSchema, output);
      } catch (error) {
        if (error instanceof CompilerError) isEqualExcludeTokenEmpty(error.diags, output);
        else throw error;
      }


      /* eslint-enable */
    };

    /* eslint-disable */
    test.each(scanTestNames(__dirname, 'dbml-parse/input'))('dbml-parse/%s', (name) => {
      runTest(name, 'dbml-parse', 'dbml', 'parseDBMLToJSONv2');
    });

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
    /* eslint-enable */
  });
});
