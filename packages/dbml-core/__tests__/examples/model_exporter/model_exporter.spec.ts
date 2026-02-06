import Parser from '../../../src/parse/Parser';
import DbmlExporter from '../../../src/export/DbmlExporter';
import JsonExporter from '../../../src/export/JsonExporter';
import MysqlExporter from '../../../src/export/MysqlExporter';
import PostgresExporter from '../../../src/export/PostgresExporter';
import SqlServerExporter from '../../../src/export/SqlServerExporter';
import OracleExporter from '../../../src/export/OracleExporter';
import { scanTestNames, getFileExtension, isEqualExcludeTokenEmpty } from '../testHelpers';
import { ExportFormatOption } from '../../../types/export/ModelExporter';
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect, describe } from 'vitest';

type ExporterClass =
  | typeof DbmlExporter
  | typeof JsonExporter
  | typeof MysqlExporter
  | typeof PostgresExporter
  | typeof SqlServerExporter
  | typeof OracleExporter;

describe('@dbml/core - model_exporter', () => {
  const runTest = (
    fileName: string,
    testDir: string,
    format: ExportFormatOption,
    ExporterClass: ExporterClass,
  ): void => {
    const fileExtension = getFileExtension(format);
    const input = JSON.parse(readFileSync(path.resolve(__dirname, `./${testDir}/input/${fileName}.in.json`), { encoding: 'utf8' }));
    const rawOutput = readFileSync(path.resolve(__dirname, `./${testDir}/output/${fileName}.out.${fileExtension}`), { encoding: 'utf8' });
    const output = fileExtension === 'json' ? JSON.parse(rawOutput) : rawOutput;

    const database = (new Parser()).parse(input, 'json');
    let res: string;
    if (format === 'json') {
      res = ExporterClass.export(database, false);
    } else {
      res = ExporterClass.export(database.normalize());
    }

    switch (format) {
      case 'json':
        isEqualExcludeTokenEmpty(JSON.parse(res), output);
        break;

      default:
        expect(res).toBe(output);
        break;
    }
  };

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

  test.each(scanTestNames(__dirname, 'oracle_exporter/input'))('oracle_exporter/%s', (name) => {
    runTest(name, 'oracle_exporter', 'oracle', OracleExporter);
  });
});

describe('@dbml/core - model_exporter dbml_exporter.escapeNote', () => {
  test('escapes simple string', () => {
    expect(DbmlExporter.escapeNote('hello')).toBe("'hello'");
  });

  test('escapes backslash in single quote string', () => {
    // Spec is not very clear about string single quote, but also escape \ with \\
    expect(DbmlExporter.escapeNote('hell\\o')).toBe("'hell\\\\o'");
  });

  test('escapes single quote with triple quotes', () => {
    // As soon as we have CRLF or single quotes, we switch to triple quotes
    expect(DbmlExporter.escapeNote("hel'lo")).toBe("'''hel\\'lo'''");
  });

  test('escapes triple quotes', () => {
    // Only triple quotes need escaping
    // See https://dbml.dbdiagram.io/docs/#multi-line-string
    expect(DbmlExporter.escapeNote("hel'''lo")).toBe("'''hel\\'\\'\\'lo'''");
  });

  test('handles newline', () => {
    expect(DbmlExporter.escapeNote('hel\nlo')).toBe("'''hel\nlo'''");
  });

  test('converts CRLF to LF', () => {
    // CRLF => \n
    expect(DbmlExporter.escapeNote('hel\r\nlo')).toBe("'''hel\nlo'''");
  });

  test('handles multiple newlines', () => {
    expect(DbmlExporter.escapeNote('hel\n\nlo')).toBe("'''hel\n\nlo'''");
  });

  test('handles single quote with newlines', () => {
    expect(DbmlExporter.escapeNote("hel'\n\nlo")).toBe("'''hel\\'\n\nlo'''");
  });

  test('handles double single quote with newlines', () => {
    expect(DbmlExporter.escapeNote("hel'\n\n''lo")).toBe("'''hel\\'\n\n\\'\\'lo'''");
  });

  test('escapes backslash with newline', () => {
    // Spec is clear here, \ needs to be escaped as \\
    expect(DbmlExporter.escapeNote('hell\\\no')).toBe("'''hell\\\\\no'''");
  });
});
