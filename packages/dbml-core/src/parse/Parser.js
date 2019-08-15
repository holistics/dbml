import Schema from '../schema/schema';
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

  static parseJSONToSchema (rawSchema) {
    const schema = new Schema(rawSchema);
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
    let rawSchema = {};
    switch (format) {
      case 'mysql':
        rawSchema = this.parseMySQLToJSON(str);
        break;

      case 'postgres':
        rawSchema = this.parsePostgresToJSON(str);
        break;

      case 'dbml':
        rawSchema = this.parseDBMLToJSON(str);
        break;

      case 'schemarb':
        rawSchema = this.parseSchemaRbToJSON(str);
        break;

      case 'json':
        if (typeof str === 'object') {
          rawSchema = str;
        } else {
          rawSchema = JSON.parse(str);
        }
        break;

      default:
        break;
    }

    const schema = Parser.parseJSONToSchema(rawSchema);
    return schema;
  }
}

export default Parser;
