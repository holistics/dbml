import { generateDatabase } from '../parse/databaseGenerator';
import Parser from '../parse/Parser';
import ModelExporter from '../export/ModelExporter';
import { DbmlExporterOptions } from 'export/DbmlExporter';

export type ImportFormat = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'postgresLegacy' | 'mssqlLegacy' | 'schemarb' | 'snowflake' | 'oracle';

export type ImportOptions = Partial<DbmlExporterOptions>;

function _import (
  str: string,
  format: ImportFormat,
  options: ImportOptions = {
    includeRecords: true,
  },
): string {
  const database = (new Parser()).parse(str, format);
  const dbml = ModelExporter.export(database.normalize(), 'dbml', normalizeImportOptions(options));

  return dbml;
}

function generateDbml (schemaJson: unknown): string {
  const database = generateDatabase(schemaJson);
  const dbml = ModelExporter.export(database.normalize(), 'dbml');

  return dbml;
}

export function normalizeImportOptions(
  options: ImportOptions,
): Required<ImportOptions> {
  const {
    includeRecords = true,
  } = options;

  return {
    includeRecords,
  };
}

export default {
  import: _import,
  generateDbml,
};
