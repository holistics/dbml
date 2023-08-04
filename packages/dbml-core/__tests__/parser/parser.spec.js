import Parser from '../../src/parse/Parser';
import fs from 'fs';
import path from 'path';

describe('@dbml/core', () => {
  describe('parser', () => {
    /**
     * @param {string} format = [json|mysql|postgres|dbml|schemarb]
     */
    const runTest = (fileName, testDir, format, parseFuncName, outputfile = false) => {
      /* eslint-disable */
      const fileExtension = getFileExtension(format);
      const input = require(`./${testDir}/input/${fileName}.in.${fileExtension}`);
      const output = require(`./${testDir}/output/${fileName}.out.json`);
      const jsonSchema = Parser[parseFuncName](input, format);
      
      if (outputfile) fs.writeFileSync(path.resolve(__dirname, `./${testDir}/pasta/${fileName}.out.json`), JSON.stringify(jsonSchema, null, 2), { flag: 'w+' });
      isEqualExcludeTokenEmpty(jsonSchema, output);
      /* eslint-enable */
    };

    /* eslint-disable */
    test.each(scanTestNames(__dirname, 'dbml-parse/input'))('dbml-parse/%s', (name) => {
      runTest(name, 'dbml-parse', 'dbml', 'parseDBMLToJSON');
    });
    
    test.each(scanTestNames(__dirname, 'mysql-parse/input'))('mysql-parse/%s', (name) => {
      runTest(name, 'mysql-parse', 'mysql', 'parseMySQLToJSON');
    });

    test.each(scanTestNames(__dirname, 'postgres-parse/input'))('postgres-parse/%s', (name) => {
      runTest(name, 'postgres-parse', 'postgres', 'parsePostgresToJSON', true);
    });

    test.each(scanTestNames(__dirname, 'schemarb-parse/input'))('schemarb-parse/%s', (name) => {
      runTest(name, 'schemarb-parse', 'schemarb', 'parseSchemaRbToJSON');
    });

    test.each(scanTestNames(__dirname, 'mssql-parse/input'))('msql-parse/%s', (name) => {
      runTest(name, 'mssql-parse', 'mssql', 'parseMSSQLToJSON');
    });
    /* eslint-enable */
  });
});
