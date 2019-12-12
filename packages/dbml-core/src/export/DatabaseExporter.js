import _ from 'lodash';
import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';

class DatabaseExporter {
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

  static export (database = {}, format) {
    let res = '';

    switch (format) {
      case 'dbml':
        res = DbmlExporter.export(database);
        break;

      case 'mysql':
        res = MysqlExporter.export(database);
        break;

      case 'postgres':
        res = PostgresExporter.export(database);
        break;

      case 'json':
        res = JsonExporter.export(database);
        break;

      case 'mssql':
        res = SqlServerExporter.export(database);
        break;

      default:
        break;
    }

    return res;
  }
}

export default DatabaseExporter;
