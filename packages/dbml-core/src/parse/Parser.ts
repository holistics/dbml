import Database, { RawDatabase } from '../model_structure/database';
import mysqlParser from './mysqlParser';
import postgresParser from './postgresParser';
import dbmlParser from './dbmlParser';
import schemarbParser from './schemarbParser';
import mssqlParser from './mssqlParser';

class Parser {
  static parseJSONToDatabase (rawDatabase: RawDatabase) {
    const database = new Database(rawDatabase);
    return database;
  }

  static parseMySQLToJSON (str: String) {
    return mysqlParser.parse(str) as RawDatabase;
  }

  static parsePostgresToJSON (str: String) {
    return postgresParser.parse(str) as RawDatabase;
  }

  static parseDBMLToJSON (str: String) {
    return dbmlParser.parse(str) as RawDatabase;
  }

  static parseSchemaRbToJSON (str: String) {
    return schemarbParser.parse(str) as RawDatabase;
  }

  static parseMSSQLToJSON (str: String) {
    return mssqlParser.parseWithPegError(str) as RawDatabase;
  }

  static parse (str: String, format: 'mysql' | 'postgres' | 'dbml' | 'schemarb' | 'mssql' | 'json') {
    let rawDatabase;
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

      case 'mssql':
        rawDatabase = Parser.parseMSSQLToJSON(str);
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
