import DbmlExporter from './DbmlExporter';
import MysqlExporter from './MysqlExporter';
import PostgresExporter from './PostgresExporter';
import JsonExporter from './JsonExporter';
import SqlServerExporter from './SqlServerExporter';
import Exporter from './Exporter';

class SchemaExporter extends Exporter {
  constructor (schema = {}) {
    super(schema);

    this.dbmlExporter = new DbmlExporter(schema);
    this.mysqlExporter = new MysqlExporter(schema);
    this.postgresExporter = new PostgresExporter(schema);
    this.jsonExporter = new JsonExporter(schema);
    this.sqlServerExporter = new SqlServerExporter(schema);
  }

  export (format) {
    let res = '';

    switch (format) {
      case 'dbml':
        res = this.dbmlExporter.export();
        break;

      case 'mysql':
        res = this.mysqlExporter.export();
        break;

      case 'postgres':
        res = this.postgresExporter.export();
        break;

      case 'json':
        res = this.jsonExporter.export();
        break;

      case 'mssql':
        res = this.sqlServerExporter.export();
        break;

      default:
        break;
    }

    return res;
  }
}

export default SchemaExporter;
