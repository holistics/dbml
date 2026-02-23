import Parser from '../../../src/parse/Parser';
import DbmlExporter from '../../../src/export/DbmlExporter';
import JsonExporter from '../../../src/export/JsonExporter';
import MysqlExporter from '../../../src/export/MysqlExporter';
import PostgresExporter from '../../../src/export/PostgresExporter';
import SqlServerExporter from '../../../src/export/SqlServerExporter';
import OracleExporter from '../../../src/export/OracleExporter';
import ModelExporter from '../../../src/export/ModelExporter';
import { scanTestNames, getFileExtension, isEqualExcludeTokenEmpty } from '../testHelpers';
import { ExportFormatOption } from '../../../types/export/ModelExporter';
import { readFileSync } from 'fs';
import path from 'path';
import { test, expect, describe } from 'vitest';

const DBML_WITH_RECORDS = `
Table users {
  id integer [pk]
  name varchar
}

Records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}
`.trim();

const EXPECTED_DBML_WITH_RECORDS = `\
Table "users" {
  "id" integer [pk]
  "name" varchar
}

Records users(id, name) {
  1, 'Alice'
  2, 'Bob'
}`;

const EXPECTED_DBML_WITHOUT_RECORDS = `\
Table "users" {
  "id" integer [pk]
  "name" varchar
}`;

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
        // Prevent meaningless spaces from failing the tests
        expect(res.trim()).toBe(output.trim());
        break;
    }
  };

  const spec = {
    json_exporter: { format: 'json' as ExportFormatOption, exporter: JsonExporter },
    dbml_exporter: { format: 'dbml' as ExportFormatOption, exporter: DbmlExporter },
    mysql_exporter: { format: 'mysql' as ExportFormatOption, exporter: MysqlExporter },
    postgres_exporter: { format: 'postgres' as ExportFormatOption, exporter: PostgresExporter },
    mssql_exporter: { format: 'mssql' as ExportFormatOption, exporter: SqlServerExporter },
    oracle_exporter: { format: 'oracle' as ExportFormatOption, exporter: OracleExporter },
  } as const;

  for (const [exporterName, { format, exporter }] of Object.entries(spec)) {
    test.each(scanTestNames(__dirname, `${exporterName}/input`))(`${exporterName}/%s`, (name) => {
      runTest(name, exporterName, format, exporter);
    });
  }
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

describe('@dbml/core - DbmlExporter flags', () => {
  describe('includeRecords', () => {
    test('includes records by default', () => {
      const database = (new Parser()).parse(DBML_WITH_RECORDS, 'dbmlv2');
      const res = DbmlExporter.export(database.normalize());
      expect(res.trim()).toBe(EXPECTED_DBML_WITH_RECORDS);
    });

    test('includes records when includeRecords is true', () => {
      const database = (new Parser()).parse(DBML_WITH_RECORDS, 'dbmlv2');
      const res = DbmlExporter.export(database.normalize(), { includeRecords: true });
      expect(res.trim()).toBe(EXPECTED_DBML_WITH_RECORDS);
    });

    test('omits records when includeRecords is false', () => {
      const database = (new Parser()).parse(DBML_WITH_RECORDS, 'dbmlv2');
      const res = DbmlExporter.export(database.normalize(), { includeRecords: false });
      expect(res.trim()).toBe(EXPECTED_DBML_WITHOUT_RECORDS);
    });
  });
});

describe('@dbml/core - ModelExporter backwards compatibility', () => {
  test('accepts boolean true as isNormalized (old signature)', () => {
    const database = (new Parser()).parse(DBML_WITH_RECORDS, 'dbmlv2');
    const normalizedModel = database.normalize();
    const resBoolean = ModelExporter.export(normalizedModel, 'dbml', true);
    const resFlags = ModelExporter.export(normalizedModel, 'dbml', { isNormalized: true });
    expect(resBoolean).toBe(resFlags);
    expect(resBoolean.trim()).toBe(EXPECTED_DBML_WITH_RECORDS);
  });

  test('accepts boolean false as isNormalized (old signature)', () => {
    const database = (new Parser()).parse(DBML_WITH_RECORDS, 'dbmlv2');
    const resBoolean = ModelExporter.export(database, 'dbml', false);
    const resFlags = ModelExporter.export(database, 'dbml', { isNormalized: false });
    expect(resBoolean).toBe(resFlags);
    expect(resBoolean.trim()).toBe(EXPECTED_DBML_WITH_RECORDS);
  });
});

describe('@dbml/core - JsonExporter backwards compatibility', () => {
  test('accepts boolean true as isNormalized (old signature)', () => {
    const database = (new Parser()).parse(DBML_WITH_RECORDS, 'dbmlv2');
    const normalizedModel = database.normalize();
    const resBoolean = JsonExporter.export(normalizedModel, true);
    const resFlags = JsonExporter.export(normalizedModel, { isNormalized: true });
    expect(resBoolean).toBe(resFlags);
    // Normalized model is the internal model format — verify the table is present
    const parsed = JSON.parse(resBoolean);
    expect(Object.values(parsed.tables as Record<string, { name: string }>).map((t) => t.name)).toContain('users');
  });

  test('accepts boolean false as isNormalized (old signature)', () => {
    const database = (new Parser()).parse(DBML_WITH_RECORDS, 'dbmlv2');
    const resBoolean = JsonExporter.export(database, false);
    const resFlags = JsonExporter.export(database, { isNormalized: false });
    expect(resBoolean).toBe(resFlags);
    // Non-normalized export uses database.export() format: { schemas, notes, records }
    const parsed = JSON.parse(resBoolean);
    expect(parsed.schemas[0].tables[0].name).toBe('users');
    expect(parsed.records[0].tableName).toBe('users');
    expect(parsed.records[0].columns).toEqual(['id', 'name']);
  });
});
