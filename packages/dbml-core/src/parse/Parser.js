import { Compiler } from '@dbml/parse';
import Database from '../model_structure/database';
import mysqlParser from './deprecated/mysqlParser';
import postgresParser from './deprecated/postgresParser';
import dbmlParser from './deprecated/dbmlParser';
import schemarbParser from './deprecated/schemarbParser';
import mssqlParser from './deprecated/mssqlParser';
import { parse } from './ANTLR/ASTGeneration';
import { CompilerError } from './error';

class Parser {
  constructor (dbmlCompiler) {
    this.DBMLCompiler = dbmlCompiler || new Compiler();
  }

  static parseJSONToDatabase (rawDatabase) {
    const database = new Database(rawDatabase);
    return database;
  }

  static parseMySQLToJSONv2 (str) {
    return parse(str, 'mysql');
  }

  /**
   * @deprecated Use the `parseMySQLToJSONv2` method instead
   */
  static parseMySQLToJSON (str) {
    return mysqlParser.parse(str);
  }

  static parsePostgresToJSONv2 (str) {
    return parse(str, 'postgres');
  }

  /**
   * @deprecated Use the `parsePostgresToJSONv2` method instead
   */
  static parsePostgresToJSON (str) {
    return postgresParser.parse(str);
  }

  static parseDBMLToJSONv2 (str, dbmlCompiler) {
    const compiler = dbmlCompiler || new Compiler();

    compiler.setSource(str);

    const diags = compiler.parse.errors().map((error) => ({
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

    return compiler.parse.rawDb();
  }

  /**
   * @deprecated Use the `parseDBMLToJSONv2` method instead
   */
  static parseDBMLToJSON (str) {
    return dbmlParser.parse(str);
  }

  static parseSchemaRbToJSON (str) {
    return schemarbParser.parse(str);
  }

  /**
   * @deprecated Use the `parseMSSQLToJSONv2` method instead
   */
  static parseMSSQLToJSON (str) {
    return mssqlParser.parseWithPegError(str);
  }

  static parseMSSQLToJSONv2 (str) {
    return parse(str, 'mssql');
  }

  static parseSnowflakeToJSON (str) {
    return parse(str, 'snowflake');
  }

  static parseOracleToJSON (str) {
    return parse(str, 'oracle');
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

        case 'snowflake':
          rawDatabase = Parser.parseSnowflakeToJSON(str);
          break;

        case 'postgresLegacy':
          rawDatabase = Parser.parsePostgresToJSON(str);
          break;

        case 'dbml':
          rawDatabase = Parser.parseDBMLToJSON(str);
          break;

        case 'dbmlv2':
          rawDatabase = Parser.parseDBMLToJSONv2(str, this.DBMLCompiler);
          break;

        case 'schemarb':
          rawDatabase = Parser.parseSchemaRbToJSON(str);
          break;

        case 'mssqlLegacy':
          rawDatabase = Parser.parseMSSQLToJSON(str);
          break;

        case 'mssql':
          rawDatabase = Parser.parseMSSQLToJSONv2(str);
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
