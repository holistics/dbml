import _ from 'lodash';
import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';

class ModelExporter {
  static export (model = {}, format, isNormalized = true) {
    let res = '';
    const normalizedModel = isNormalized ? model : model.normalize();

    switch (format) {
      case 'dbml':
        res = DbmlExporter.export(normalizedModel);
        break;

      case 'mysql':
        res = MysqlExporter.export(normalizedModel);
        break;

      case 'postgres':
        res = PostgresExporter.export(normalizedModel);
        break;

      case 'json':
        res = JsonExporter.export(model, isNormalized);
        break;

      case 'mssql':
        res = SqlServerExporter.export(normalizedModel);
        break;

      default:
        break;
    }

    return res;
  }
}

export default ModelExporter;
