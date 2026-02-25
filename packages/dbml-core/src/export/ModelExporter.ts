import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';
import OracleExporter from './OracleExporter';
import Database from '../model_structure/database';
import type { NormalizedModel } from '../../types/model_structure/database';
import { ExportFlags, ExportFormatOption, normalizeExportFlags } from './index';

class ModelExporter {
  /**
   * @deprecated Passing a boolean as the third argument is deprecated. Use `ExportFlags` instead.
   */
  static export (
    model: Database | NormalizedModel,
    format: ExportFormatOption,
    flags: boolean,
  ): string;

  static export (
    model: Database | NormalizedModel,
    format: ExportFormatOption,
    flags?: ExportFlags,
  ): string;

  static export (
    model: Database | NormalizedModel,
    format: ExportFormatOption,
    flags: ExportFlags | boolean = {
      isNormalized: true,
      includeRecords: true,
    },
  ): string {
    const {
      isNormalized,
      includeRecords,
    } = normalizeExportFlags(flags);

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
