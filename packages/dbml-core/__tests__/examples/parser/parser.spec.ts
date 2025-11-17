import Parser from '../../../src/parse/Parser';
import { scanTestNames, getFileExtension, isEqualExcludeTokenEmpty } from '../testHelpers';
import { ParseFormat } from '../../../types/parse/Parser';

describe('@dbml/core', () => {
  describe('parser', () => {
    const runTest = async (
      fileName: string,
      testDir: string,
      format: ParseFormat,
      parseFuncName: string,
    ) => {
      const fileExtension = getFileExtension(format);

      const input = await import(`./${testDir}/input/${fileName}.in.${fileExtension}`);
      const output = await import(`./${testDir}/output/${fileName}.out.json`);
      const jsonSchema = (Parser as any)[parseFuncName](input);
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
      runTest(name, 'mssql-parse', 'mssql', 'parseMSSQLToJSONv2');
    });

    test.each(scanTestNames(__dirname, 'oracle-parse/input'))('oracle-parse/%s', (name) => {
      runTest(name, 'oracle-parse', 'oracle', 'parseOracleToJSON');
    });
  });
});
