import { Compiler } from '@dbml/parse';
import Database from '../model_structure/database';
import mysqlParser from './mysqlParser';
import postgresParser from './postgresParser';
import dbmlParser from './dbmlParser';
import schemarbParser from './schemarbParser';
import mssqlParser from './mssqlParser';
import oracleParser from './oracleParser';
import { parse } from './ANTLR/ASTGeneration';
import { CompilerError } from './error';

class Parser {
  constructor (DBMLCompiler) {
    this.DBMLCompiler = DBMLCompiler || new Compiler();
  }

  static parseJSONToDatabase (rawDatabase) {
    const database = new Database(rawDatabase);
    return database;
  }

  static parseMySQLToJSONv2 (str) {
    return parse(str, 'mysql');
  }

  static parseMySQLToJSON (str) {
    return mysqlParser.parse(str);
  }

  static parsePostgresToJSONv2 (str) {
    return parse(str, 'postgres');
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

  static parseMSSQLToJSON (str) {
    return mssqlParser.parseWithPegError(str);
  }

  static parseOracleToJSON (str) {
    return oracleParser.parse(str);
  }

  static parse (str, format) {
    return new Parser().parse(str, format);
  }

  parse (str, format) {
    try {
      let rawDatabase = {};
      switch (format) {
        case 'mysql':
          rawDatabase = Parser.parseMySQLToJSONv2(str);
          break;

        case 'mysqlLegacy':
          rawDatabase = Parser.parseMySQLToJSON(str);
          break;

        case 'postgres':
          rawDatabase = Parser.parsePostgresToJSONv2(str);
          break;

        case 'postgresLegacy':
          rawDatabase = Parser.parsePostgresToJSON(str);
          break;

        case 'dbml':
          rawDatabase = Parser.parseDBMLToJSON(str);
          break;

        case 'dbmlv2': {
          this.DBMLCompiler.setSource(str);

          const diags = this.DBMLCompiler.parse.errors().map((error) => ({
            message: error.diagnostic,
            location: {
              start: {
                line: error.nodeOrToken.startPos.line + 1,
                column: error.nodeOrToken.startPos.column + 1,
              },
              end: {
                line: error.nodeOrToken.endPos.line + 1,
                column: error.nodeOrToken.endPos.column + 1,
              },
            },
            code: error.code,
          }));

          if (diags.length > 0) throw CompilerError.create(diags);
        }
          rawDatabase = this.DBMLCompiler.parse.rawDb();
          break;

        case 'schemarb':
          rawDatabase = Parser.parseSchemaRbToJSON(str);
          break;

        case 'mssql':
          rawDatabase = Parser.parseMSSQLToJSON(str);
          break;

        case 'oracle':
          rawDatabase = Parser.parseOracleToJSON(str);
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
    } catch (diags) {
      throw CompilerError.create(diags);
    }
  }
}

export default Parser;
