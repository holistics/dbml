import Database from '../model_structure/database';
import mysqlParser from './mysqlParser';
import postgresParser from './postgresParser';
import dbmlParser from './dbmlParser';
import schemarbParser from './schemarbParser';

class Parser {
  constructor () {
    this.mysqlParser = mysqlParser;
    this.postgresParser = postgresParser;
    this.dbmlParser = dbmlParser;
    this.schemarbParser = schemarbParser;
  }

  static parseJSONToDatabase (rawDatabase) {
    const schema = new Database(rawDatabase);
    return schema;
  }

  parseMySQLToJSON (str) {
    return this.mysqlParser.parse(str);
  }

  parsePostgresToJSON (str) {
    return this.postgresParser.parse(str);
  }

  parseDBMLToJSON (str) {
    return this.dbmlParser.parse(str);
  }

  parseSchemaRbToJSON (str) {
    return this.schemarbParser.parse(str);
  }

  parse (str, format) {
    let rawDatabase = {};
    switch (format) {
      case 'mysql':
        rawDatabase = this.parseMySQLToJSON(str);
        break;

      case 'postgres':
        rawDatabase = this.parsePostgresToJSON(str);
        break;

      case 'dbml':
        rawDatabase = this.parseDBMLToJSON(str);
        break;

      case 'schemarb':
        rawDatabase = this.parseSchemaRbToJSON(str);
        break;

      case 'json':
        if (typeof str === 'object') {
          rawDatabase = str;
        } else {
          rawDatabase = JSON.parse(str);
        }
        break;

      default:
        break;
    }

    const schema = Parser.parseJSONToDatabase(rawDatabase);
    return schema;
  }
}

export default Parser;
