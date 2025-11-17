import { readFileSync } from 'fs';
import Parser from '../../../src/parse/Parser';
import { scanTestNames, getFileExtension, isEqualExcludeTokenEmpty } from '../testHelpers';
import { ParseFormat } from '../../../types/parse/Parser';
import path from 'path';

describe('@dbml/core', () => {
  describe('parser', () => {
    const runTest = async (
      fileName: string,
      testDir: string,
      format: ParseFormat,
      parseFuncName: string,
    ) => {
      const fileExtension = getFileExtension(format);

      const input = readFileSync(path.resolve(__dirname, `./${testDir}/input/${fileName}.in.${fileExtension}`), { encoding: 'utf8' });
      const output = JSON.parse(readFileSync(path.resolve(__dirname, `./${testDir}/output/${fileName}.out.json`), { encoding: 'utf8' }));
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
