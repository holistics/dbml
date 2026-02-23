import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';
import OracleExporter from './OracleExporter';

class ModelExporter {
  /**
   * @param {object} model
   * @param {string} format
   * @param {object|boolean} flags
   * @deprecated Passing a boolean as the third argument is deprecated. Use `{ isNormalized: boolean }` instead.
   */
  static export (model = {}, format = '', flags = {}) {
    let res = '';
    // Backwards compatibility: if a boolean is passed, treat it as the isNormalized flag
    const resolvedFlags = typeof flags === 'boolean' ? { isNormalized: flags } : flags;
    // isNormalized defaults to true; when false, the model is normalized before exporting
    const isNormalized = resolvedFlags.isNormalized !== false;
    const normalizedModel = isNormalized ? model : model.normalize();
    switch (format) {
      case 'dbml':
        res = DbmlExporter.export(normalizedModel, resolvedFlags);
        break;

      case 'mysql':
        res = MysqlExporter.export(normalizedModel);
        break;

      case 'postgres':
        res = PostgresExporter.export(normalizedModel);
        break;

      case 'json':
        res = JsonExporter.export(model, resolvedFlags);
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
