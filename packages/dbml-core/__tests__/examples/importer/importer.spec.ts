import importer from '../../../src/import';
import Parser from '../../../src/parse/Parser';
import { scanTestNames, getFileExtension } from '../testHelpers';
import { ParseFormat } from '../../../types/parse/Parser';
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect, describe } from 'vitest';

describe('@dbml/core - importer optional refs', () => {
  describe('postgres', () => {
    test('NOT NULL FK to PK', () => {
      const sql = `
        CREATE TABLE a (id int PRIMARY KEY);
        CREATE TABLE b (id int PRIMARY KEY, a_id int NOT NULL REFERENCES a(id));
      `;
      expect(importer.import(sql, 'postgres')).toContain('Ref:"a"."id" <? "b"."a_id"');
    });

    test('nullable FK to PK', () => {
      const sql = `
        CREATE TABLE a (id int PRIMARY KEY);
        CREATE TABLE b (id int PRIMARY KEY, a_id int REFERENCES a(id));
      `;
      expect(importer.import(sql, 'postgres')).toContain('Ref:"a"."id" ?<? "b"."a_id"');
    });

    test('NOT NULL FK to UNIQUE', () => {
      const sql = `
        CREATE TABLE a (id int PRIMARY KEY, code int UNIQUE NOT NULL);
        CREATE TABLE b (id int PRIMARY KEY, a_code int NOT NULL REFERENCES a(code));
      `;
      expect(importer.import(sql, 'postgres')).toContain('Ref:"a"."code" <? "b"."a_code"');
    });

    test('nullable FK to UNIQUE', () => {
      const sql = `
        CREATE TABLE a (id int PRIMARY KEY, code int UNIQUE NOT NULL);
        CREATE TABLE b (id int PRIMARY KEY, a_code int REFERENCES a(code));
      `;
      expect(importer.import(sql, 'postgres')).toContain('Ref:"a"."code" ?<? "b"."a_code"');
    });
  });

  describe('mysql', () => {
    test('NOT NULL FK to PK', () => {
      const sql = `
        CREATE TABLE a (id int PRIMARY KEY);
        CREATE TABLE b (id int PRIMARY KEY, a_id int NOT NULL, FOREIGN KEY (a_id) REFERENCES a(id));
      `;
      expect(importer.import(sql, 'mysql')).toContain('Ref:"a"."id" <? "b"."a_id"');
    });

    test('nullable FK to PK', () => {
      const sql = `
        CREATE TABLE a (id int PRIMARY KEY);
        CREATE TABLE b (id int PRIMARY KEY, a_id int, FOREIGN KEY (a_id) REFERENCES a(id));
      `;
      expect(importer.import(sql, 'mysql')).toContain('Ref:"a"."id" ?<? "b"."a_id"');
    });
  });
});

describe('@dbml/core - importer postgres types', () => {
  test('keeps the time zone of timestamp and time', () => {
    const sql = `
      CREATE TABLE t (
        a timestamp with time zone,
        b timestamp(3) with time zone,
        c time with time zone,
        d timestamp without time zone,
        e TIMESTAMP WITH TIME ZONE
      );
    `;
    const res = importer.import(sql, 'postgres');
    expect(res).toContain('"a" timestamptz\n');
    expect(res).toContain('"b" timestamptz(3)\n');
    expect(res).toContain('"c" timetz\n');
    expect(res).toContain('"d" timestamp\n');
    expect(res).toContain('"e" TIMESTAMPTZ\n');
  });

  test('prints a schema-qualified non-enum type once', () => {
    const sql = 'CREATE TABLE t (email extensions.citext);';
    const res = importer.import(sql, 'postgres');
    expect(res).toContain('"email" extensions.citext\n');
    expect(() => new Parser().parse(res, 'dbmlv2')).not.toThrow();
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
