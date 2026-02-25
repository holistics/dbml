import { generateDatabase } from '../parse/databaseGenerator';
import Parser from '../parse/Parser';
import ModelExporter from '../export/ModelExporter';
import { DbmlExporterFlags } from 'export/DbmlExporter';

export type ImportFormatOption = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'postgresLegacy' | 'mssqlLegacy' | 'oracle';

export type ImportFlags = Partial<DbmlExporterFlags>;

function _import (
  str: string,
  format: ImportFormatOption,
  flags: ImportFlags = {
    includeRecords: true,
  },
): string {
  const database = (new Parser()).parse(str, format);
  const dbml = ModelExporter.export(database.normalize(), 'dbml', normalizeImportFlags(flags));

  return dbml;
}

function generateDbml (schemaJson: unknown): string {
  const database = generateDatabase(schemaJson);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

export function normalizeImportFlags(
  flags: ImportFlags,
): Required<ImportFlags> {
  const {
    includeRecords = true,
  } = flags;

  return {
    includeRecords,
  };
}

export default {
  import: _import,
  generateDbml,
};
