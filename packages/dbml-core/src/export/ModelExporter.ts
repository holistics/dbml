import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';
import OracleExporter from './OracleExporter';
import Database from '../model_structure/database';
import type { NormalizedModel } from '../../types/model_structure/model';
import { ExportOptions, ExportFormat, normalizeExportOptions } from './index';

class ModelExporter {
  // DBML format: returns per-file mapping when >1 file
  static export (
    model: Database | NormalizedModel,
    format: 'dbml',
    options?: ExportOptions | boolean,
  ): string | Record<string, string>;

  // Non-DBML formats: always returns string (throws if >1 file)
  static export (
    model: Database | NormalizedModel,
    format: Exclude<ExportFormat, 'dbml'>,
    options?: ExportOptions | boolean,
  ): string;

  static export (
    model: Database | NormalizedModel,
    format: ExportFormat,
    options?: ExportOptions | boolean,
  ): string | Record<string, string>;

  static export (
    model: Database | NormalizedModel,
    format: ExportFormat,
    options: ExportOptions | boolean = {
      isNormalized: true,
      includeRecords: true,
    },
  ): string | Record<string, string> {
    const {
      isNormalized,
      includeRecords,
    } = normalizeExportOptions(options);

    let normalizedModel: NormalizedModel;
    if (model instanceof Database) {
      normalizedModel = model.normalize();
    } else {
      normalizedModel = model;
    }

    const multiFile = normalizedModel.files.length > 1;

    // DBML multi-file: return per-file mapping
    if (format === 'dbml' && multiFile) {
      const result: Record<string, string> = {};
      for (const file of normalizedModel.files) {
        // TODO: filter normalizedModel to this file's scope and export
        result[file.filepath] = DbmlExporter.export(normalizedModel, { includeRecords });
      }
      return result;
    }

    // Non-DBML/JSON with >1 file: error
    if (multiFile && format !== 'json') {
      throw new Error(
        `Cannot export ${format} with multiple files. `
        + 'Use Parser.parseProject with an entrypoint, or use interpretFile to get a single-file Database.',
      );
    }

    switch (format) {
      case 'dbml':
        return DbmlExporter.export(normalizedModel, { includeRecords });
      case 'mysql':
        return MysqlExporter.export(normalizedModel);
      case 'postgres':
        return PostgresExporter.export(normalizedModel);
      case 'json':
        return JsonExporter.export(model, { isNormalized });
      case 'mssql':
        return SqlServerExporter.export(normalizedModel);
      case 'oracle':
        return OracleExporter.export(normalizedModel);
      default:
        return '';
    }
  }
}

export default ModelExporter;
