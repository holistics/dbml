import Database from '../model_structure/database';
import mysqlParser from './mysqlParser';
import postgresParser from './postgresParser';
import dbmlParser from './dbmlParser';
import schemarbParser from './schemarbParser';

class Parser {
  static parseJSONToDatabase (rawDatabase) {
    const database = new Database(rawDatabase);
    return database;
  }

  static parseMySQLToJSON (str) {
    return mysqlParser.parse(str);
  }

  static parsePostgresToJSON (str) {
    return postgresParser.parse(str);
  }

  static parseDBMLToJSON (str) {
    return dbmlParser.parse(str);
  }

  static parseSchemaRbToJSON (str) {
    return schemarbParser.parse(str);
  }

  static parse (str, format) {
    let rawDatabase = {};
    switch (format) {
      case 'mysql':
        rawDatabase = Parser.parseMySQLToJSON(str);
        break;

      case 'postgres':
        rawDatabase = Parser.parsePostgresToJSON(str);
        break;

      case 'dbml':
        rawDatabase = Parser.parseDBMLToJSON(str);
        break;

      case 'schemarb':
        rawDatabase = Parser.parseSchemaRbToJSON(str);
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
