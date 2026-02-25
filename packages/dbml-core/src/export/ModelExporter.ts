import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';
import OracleExporter from './OracleExporter';
import Database from '../model_structure/database';
import type { NormalizedModel } from '../../types/model_structure/database';
import { ExportOptions, ExportFormat, normalizeExportOptions } from './index';

class ModelExporter {
  /**
   * @deprecated Passing a boolean as the third argument is deprecated. Use `ExportOptions` instead.
   */
  static export (
    model: Database | NormalizedModel,
    format: ExportFormat,
    options: boolean,
  ): string;

  static export (
    model: Database | NormalizedModel,
    format: ExportFormat,
    options?: ExportOptions,
  ): string;

  static export (
    model: Database | NormalizedModel,
    format: ExportFormat,
    options: ExportOptions | boolean = {
      isNormalized: true,
      includeRecords: true,
    },
  ): string {
    const {
      isNormalized,
      includeRecords,
    } = normalizeExportOptions(options);

    const normalizedModel: NormalizedModel = model instanceof Database
      ? model.normalize()
      : model;

    let res = '';
    switch (format) {
      case 'dbml':
        res = DbmlExporter.export(normalizedModel, { includeRecords });
        break;

      case 'mysql':
        res = MysqlExporter.export(normalizedModel);
        break;

      case 'postgres':
        res = PostgresExporter.export(normalizedModel);
        break;

      case 'json':
        res = JsonExporter.export(model, { isNormalized });
        break;

      case 'mssql':
        res = SqlServerExporter.export(normalizedModel);
        break;

      case 'oracle':
        res = OracleExporter.export(normalizedModel);
        break;

      default:
        break;
    }

    return res;
  }
}

export default ModelExporter;
