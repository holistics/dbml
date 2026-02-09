import importer from '../../../src/import';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ParseFormat } from '../../../types/parse/Parser';
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect, describe } from 'vitest';

describe('@dbml/core - importer', () => {
  const runTest = async (fileName: string, testDir: string, format: ParseFormat) => {
    const fileExtension = getFileExtension(format);
    const input = readFileSync(path.resolve(__dirname, `./${testDir}/input/${fileName}.in.${fileExtension}`), { encoding: 'utf8' });
    const output = readFileSync(path.resolve(__dirname, `./${testDir}/output/${fileName}.out.dbml`), { encoding: 'utf8' });

    const res = importer.import(input, format);

    expect(res).toBe(output);
  };

  const spec = {
    json_importer: 'json',
    mysql_importer: 'mysql',
    postgres_importer: 'postgres',
    mssql_importer: 'mssql',
    snowflake_importer: 'snowflake',
    oracle_importer: 'oracle',
  } as const;

  for (const [importer, type] of Object.entries(spec)) {
    test.each(scanTestNames(__dirname, `${importer}/input`))(`${importer}/%s`, async (name) => {
      await runTest(name, importer, type);
    });
  }
});
