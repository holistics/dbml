import { readFileSync } from 'fs';
import Parser from '../../../src/parse/Parser';
import { scanTestNames, getFileExtension, isEqualExcludeTokenEmpty } from '../testHelpers';
import { ParseFormat } from '../../../types/parse/Parser';
import path from 'path';
import { test, describe } from 'vitest';

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

    const spec = {
      'mysql-parse': { format: 'mysql' as ParseFormat, parseFunc: 'parseMySQLToJSONv2' },
      'postgres-parse': { format: 'postgres' as ParseFormat, parseFunc: 'parsePostgresToJSONv2' },
      'schemarb-parse': { format: 'schemarb' as ParseFormat, parseFunc: 'parseSchemaRbToJSON' },
      'mssql-parse': { format: 'mssql' as ParseFormat, parseFunc: 'parseMSSQLToJSONv2' },
      'oracle-parse': { format: 'oracle' as ParseFormat, parseFunc: 'parseOracleToJSON' },
      'snowflake-parse': { format: 'snowflake' as ParseFormat, parseFunc: 'parseSnowflakeToJSON' },
    } as const;

    for (const [parser, { format, parseFunc }] of Object.entries(spec)) {
      test.each(scanTestNames(__dirname, `${parser}/input`))(`${parser}/%s`, async (name) => {
        await runTest(name, parser, format, parseFunc);
      });
    }
  });
});
