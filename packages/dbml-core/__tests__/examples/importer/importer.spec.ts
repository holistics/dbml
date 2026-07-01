import importer from '../../../src/import';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ParseFormat } from '../../../types/parse/Parser';
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect, describe } from 'vitest';

describe('@dbml/core - importer optional refs', () => {
  const POSTGRES_NULLABLE_FK = `
    CREATE TABLE users (id int PRIMARY KEY);
    CREATE TABLE posts (
      id int PRIMARY KEY,
      user_id int REFERENCES users(id)
    );
  `;

  const POSTGRES_NOT_NULL_FK = `
    CREATE TABLE users (id int PRIMARY KEY);
    CREATE TABLE posts (
      id int PRIMARY KEY,
      user_id int NOT NULL REFERENCES users(id)
    );
  `;

  const MYSQL_NULLABLE_FK = `
    CREATE TABLE users (id int PRIMARY KEY);
    CREATE TABLE posts (
      id int PRIMARY KEY,
      user_id int,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  const MYSQL_NOT_NULL_FK = `
    CREATE TABLE users (id int PRIMARY KEY);
    CREATE TABLE posts (
      id int PRIMARY KEY,
      user_id int NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  test('postgres: nullable FK column produces optional ref', () => {
    const res = importer.import(POSTGRES_NULLABLE_FK, 'postgres');
    expect(res).toContain('Ref:"users"."id" <? "posts"."user_id"');
  });

  test('postgres: NOT NULL FK column produces required ref', () => {
    const res = importer.import(POSTGRES_NOT_NULL_FK, 'postgres');
    expect(res).toContain('Ref:"users"."id" < "posts"."user_id"');
  });

  test('mysql: nullable FK column produces optional ref', () => {
    const res = importer.import(MYSQL_NULLABLE_FK, 'mysql');
    expect(res).toContain('Ref:"users"."id" <? "posts"."user_id"');
  });

  test('mysql: NOT NULL FK column produces required ref', () => {
    const res = importer.import(MYSQL_NOT_NULL_FK, 'mysql');
    expect(res).toContain('Ref:"users"."id" < "posts"."user_id"');
  });
});

describe('@dbml/core - importer', () => {
  const runTest = async (fileName: string, testDir: string, format: ParseFormat) => {
    const fileExtension = getFileExtension(format);
    const input = readFileSync(path.resolve(__dirname, `./${testDir}/input/${fileName}.in.${fileExtension}`), { encoding: 'utf8' });
    const res = importer.import(input, format);
    const output = readFileSync(path.resolve(__dirname, `./${testDir}/output/${fileName}.out.dbml`), { encoding: 'utf8' });

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
