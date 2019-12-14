import _ from 'lodash';
import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';

class ModelExporter {
  static getIndexesFromSchema (schema) {
    const indexes = [];

    schema.tables.forEach((table) => {
      if (!_.isEmpty(table.indexes)) {
        // primary composite key is not included here
        const tableIndexes = table.indexes.filter((index) => !index.pk);
        indexes.push(...tableIndexes);
      }
    });

    return indexes;
  }

  static getCommentsFromSchema (schema) {
    const comments = [];

    schema.tables.forEach((table) => {
      table.fields.forEach((field) => {
        if (field.note) {
          comments.push({
            type: 'column',
            table,
            field,
          });
        }
      });
    });

    return comments;
  }

  static hasWhiteSpace (s) {
    return /\s/g.test(s);
  }

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
