import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';
import OracleExporter from './OracleExporter';
import Database, { NormalizedModel } from '../model_structure/database';

export type ExportFormatOption = 'dbml' | 'mysql' | 'postgres' | 'json' | 'mssql' | 'oracle';

export interface ExportFlags {
  isNormalized?: boolean;
  includeRecords?: boolean;
}

class ModelExporter {
  /**
   * @deprecated Passing a boolean as the third argument is deprecated. Use `{ isNormalized: boolean }` instead.
   */
  static export (
    model: Database | NormalizedModel,
    format: ExportFormatOption,
    isNormalized: boolean,
  ): string;

  static export (
    model: Database | NormalizedModel,
    format: ExportFormatOption,
    flags?: ExportFlags,
  ): string;

  static export (
    model: Database | NormalizedModel,
    format: ExportFormatOption,
    flags: ExportFlags | boolean = {},
  ) {
    let res = '';
    // Backwards compatibility: if a boolean is passed, treat it as the isNormalized flag
    const resolvedFlags: ExportFlags = typeof flags === 'boolean' ? { isNormalized: flags } : flags;
    // isNormalized defaults to true; when false, the model is normalized before exporting
    
    const {
      isNormalized = true,
      includeRecords = true,
    } = resolvedFlags;

    const normalizedModel = isNormalized ? model as NormalizedModel : (model as Database).normalize();

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
